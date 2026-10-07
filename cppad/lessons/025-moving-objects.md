---
id: 25
title: Moving objects
concept: the cost of copying, returning a local, move constructor, move assignment, rvalue references, lvalues and rvalues, when the compiler moves, copy elision, std::move, moved-from objects, noexcept moves
minutes: 15
source: A Tour of C++
source_pages: 50-52
---
# Moving objects

Lesson 24 taught Vector to copy itself properly, but that isn't free: copying 10,000 doubles takes new memory for all of them and a loop over every one. Section 4.6.2 (p. 50) is about copies nobody asked for.

## A copy nobody wanted

Passing a big object *into* a function is cheap: take a `const&` (lesson 7). Getting one *out* is the problem: a function can't return a reference to its own local, which dies as the function returns (lesson 11). So it returns by value. Here is the book's `+` for Vectors (with an `assert`, lesson 16, where the book throws):

```cpp
Vector operator+(const Vector& a, const Vector& b) {
    assert(a.size() == b.size());
    Vector res(a.size());
    for (int i = 0; i < a.size(); ++i) {
        res[i] = a[i] + b[i];          // the const operator[] from lesson 24
    }
    return res;
}
```

With only copy operations, the book counts two wasted copies in `r = x + y + z;`, one per `+`, each made just before `res` is destroyed. (Today's compilers skip some, as you'll see, but not all.) We never wanted a second array, only the first one handed over: a **move**.

## The move constructor

Moving a handle is cheap, whatever its size: take the source's pointer and size, and leave the source empty. The book adds two members to lesson 24's Vector (p. 51). The **move constructor** builds a new object by taking over another one's elements (`&&` comes next), here defined outside the class (lesson 13):

```cpp
class Vector {
public:
    // ... as in lesson 24, plus:
    Vector(Vector&& a);              // move constructor
    Vector& operator=(Vector&& a);   // move assignment
};

Vector::Vector(Vector&& a)
    : elem{a.elem}, sz{a.sz}   // take a's elements
{
    a.elem = nullptr;          // a has no elements now
    a.sz = 0;
}
```

```text
before:  a            elem o-----> [ 3 | 5 | 7 ]   sz 3

after:   a            elem nullptr                 sz 0
         new Vector   elem o-----> [ 3 | 5 | 7 ]   sz 3
```

- The parameter isn't `const`. A move changes its source.
- Why reset `a` at all? `a` still gets destroyed later, and if it still pointed at the array, its destructor would delete the array the new Vector now owns: lesson 24's double delete. `delete[]` on `nullptr` does nothing, so an emptied Vector is safe to destroy.

## `&&`: rvalue references

`Vector&&` (nothing to do with lesson 3's *and*) is an **rvalue reference**. You've met both words in Clang's errors: an *lvalue* (lesson 7) is an object you can name, like `x` or `v[0]`, that could stand on the left of `=`; an *rvalue* (lesson 12) was a plain value like `2`. The result of `x + y`, or of a function returning by value, is an rvalue too: a temporary (lesson 18), an unnamed object gone at the end of the statement. Nobody can look at it afterwards, so taking its contents is safe. An rvalue reference binds only to rvalues.

With both copy and move operations, the compiler picks by what you hand it:

```cpp
r = x;          // x is an lvalue, still in use: copy assignment
r = x + y;      // x + y is a temporary: move assignment
```

The **move assignment** (the book only declares it) is copy assignment without the copying:

```cpp
Vector& Vector::operator=(Vector&& a) {
    delete[] elem;         // give back our old elements (safe first: none
                           // is read, so v = std::move(v) just empties v)
    elem = a.elem;         // take a's
    sz = a.sz;
    a.elem = nullptr;      // leave a empty
    a.sz = 0;
    return *this;          // lesson 18
}
```

## When does C++ move?

Watch a class that reports its copies and moves. Tap **Open in editor** and **▶ Run**:

```cpp
#include <iostream>

struct Tracer {
    Tracer() { }   // needed: other constructors turn off the default one
    Tracer(const Tracer&) { std::cout << "  copy\n"; }
    Tracer(Tracer&&) noexcept { std::cout << "  move\n"; }
    Tracer& operator=(const Tracer&) { std::cout << "  copy=\n"; return *this; }
    Tracer& operator=(Tracer&&) noexcept { std::cout << "  move=\n"; return *this; }
};

Tracer make() {
    Tracer t;
    return t;
}

Tracer pass(Tracer t) {
    return t;
}

int main() {
    std::cout << "Tracer a = make():\n";
    Tracer a = make();
    std::cout << "Tracer b = a:\n";
    Tracer b = a;
    std::cout << "Tracer c = pass(b):\n";
    Tracer c = pass(b);
    std::cout << "c = make():\n";
    c = make();
}
```

```text
Tracer a = make():
Tracer b = a:
  copy
Tracer c = pass(b):
  copy
  move
c = make():
  move=
```

- **`Tracer a = make()` prints nothing.** The compiler built `t` straight in `a`'s place: no copy, no move. That's **copy elision**. C++ allows it when a function returns the same local on every path (Clang does it; it isn't guaranteed), and requires it for a returned temporary, like `return Tracer{};`.
- **`Tracer b = a` copies.** `a` is an lvalue: it might be used again.
- **`pass(b)` copies in and moves out.** `b` is an lvalue, so the parameter `t` is a copy. `t` exists before `pass` starts, so it can't be built in `c`'s place: no elision. But `return t;` moves: a local being returned is about to vanish, so C++ treats it as an rvalue.
- **`c = make()` moves.** `c` already exists, so `make()` can't build in its place. It builds a temporary instead (elided, as for `a`), and the move assignment hands that to `c`.

The rule: C++ moves when the source is about to vanish (a temporary, or a local being returned), and copies otherwise. Often elision skips even the move. In the book's `r = x + y + z;`, each `+` builds its result in place and the last is moved into `r`: no Vector copied. Lesson 20's `read()` can return its Vector by value after all.

## `std::move`

Outside a `return`, a named variable never looks about to vanish, even on its last use. `std::move(x)`, from `<utility>`, is your promise that you're done with `x`. Despite its name it moves nothing: it only turns `x` into an rvalue, so the move operations get picked. The book's example (p. 52):

```cpp
Vector f() {
    Vector x(1000);
    Vector y(1000);
    Vector z(1000);
    z = x;              // copy: x is an lvalue
    y = std::move(x);   // move: we're done with x
    return z;           // the book says move; usually it's elided
}
```

Just before the `return`:

```text
x   elem nullptr                   sz 0
y   elem o-----> [ 1000 doubles ]  sz 1000    (x's old array)
z   elem o-----> [ 1000 doubles ]  sz 1000    (a copy of it)
```

`std::move` is only a request. If the type has no move operations, or `x` is `const` (a const object can't be emptied), the copy operations take it: a silent copy.

After a move, `x` is a **moved-from** object: still valid, so it can be destroyed or assigned a new value. What else it holds depends on the type. Our Vector's moves leave it empty; standard-library types only promise "valid but unspecified": `x.size()` still answers, but nobody says what. Here a moved-from `std::string` or `std::vector` came out empty, but don't count on that.

> ⚠️ **Using an object after `std::move`.** Reading `x` after `y = std::move(x);` compiles without a warning and gives you whatever the move left behind. Treat `x` as holding nothing useful: assign it a new value or let it be destroyed.

`std::unique_ptr` is different, and pays off lesson 23's promise: it can't be copied, but it can be moved, and a moved-from one is guaranteed to be `nullptr`:

```cpp
auto spare = std::make_unique<Bus>(40);   // lesson 23's Bus, 40 seats
depot.push_back(std::move(spare));        // the depot owns the bus now
// spare is nullptr
```

> 💡 Don't write `return std::move(t);`. It blocks copy elision, turning nothing into a move, and Clang warns: `moving a local object in a return statement prevents copy elision`. A plain `return t;` already moves when it can't elide.

## Mark moves `noexcept`

When a `std::vector` grows (lesson 6's `push_back`), it transfers its elements to a bigger array. If a move threw an exception halfway, they'd be split between two arrays with no way back. So the vector moves them only if their type's move constructor is marked `noexcept` (lesson 15). Otherwise it copies: if a copy fails, the originals are untouched and the new array can be thrown away. (Here, with exceptions off, the library moves either way.)

A move that just takes a pointer and a size can't fail, so say so: mark both move operations `noexcept`, as `Tracer` does. On Vector, write it twice:

```cpp
Vector(Vector&& a) noexcept;           // in the class, and
Vector::Vector(Vector&& a) noexcept    // outside it, or Clang stops with
    : elem{a.elem}, sz{a.sz}           // 'Vector' is missing exception
{                                      // specification 'noexcept'
    // ...
}
```

## Exercise: Hand over the timings

Here is lesson 24's `Timings`. Its copy operations are given, and now print `copy` and `copy=`. Add the moves:

1. The move constructor `Timings(Timings&& t) noexcept`: take `t`'s `elem` and `sz`, empty `t`, print `move` (indented two spaces, like `copy`).
2. The move assignment `Timings& operator=(Timings&& t) noexcept`: `delete[]` your own elements, take `t`'s, empty `t`, print `move=` and return `*this`.

`main` is written. `express_run` returns one of two locals, so its `return` must move. Printing the moved-from `a` and `b` is fine only because your moves promise to leave 0 segments; a library type wouldn't.

```expected
a = express_run(true):
  move
a: 3 segments, 7 min
b {std::move(a)}:
  move
c = std::move(b):
  move=
a: 0 segments, 0 min
b: 0 segments, 0 min
c: 3 segments, 7 min
```

The starter runs. Tap **▶ Run** first: each `move` says `copy` (`move=` says `copy=`), and `a` and `b` keep their 3 segments. A class that declares its own copy operations or destructor gets no compiler-made moves (lesson 26 has the rules), so the rvalues go to the copy operations: a `const Timings&` binds to rvalues too (as lesson 18's `print` took the temporary `Money{}`). Write the two functions and run again.

```cpp starter
#include <initializer_list>
#include <iostream>
#include <string>
#include <utility>

class Timings {
public:
    Timings(std::initializer_list<int> list)
        : elem{new int[list.size()]}, sz{static_cast<int>(list.size())} {
        int i {0};
        for (int m : list) {
            elem[i] = m;
            ++i;
        }
    }

    Timings(const Timings& t) : elem{new int[t.sz]}, sz{t.sz} {
        for (int i = 0; i < sz; ++i) {
            elem[i] = t.elem[i];
        }
        std::cout << "  copy\n";
    }

    Timings& operator=(const Timings& t) {
        int* p {new int[t.sz]};
        for (int i = 0; i < t.sz; ++i) {
            p[i] = t.elem[i];
        }
        delete[] elem;
        elem = p;
        sz = t.sz;
        std::cout << "  copy=\n";
        return *this;
    }

    // TODO 1: the move constructor Timings(Timings&& t) noexcept
    //         - member initializer list: take t's elem and sz
    //         - body: set t.elem to nullptr and t.sz to 0,
    //           then print "  move"

    // TODO 2: the move assignment Timings& operator=(Timings&& t) noexcept
    //         - delete[] your own elem, take t's elem and sz
    //         - set t.elem to nullptr and t.sz to 0
    //         - print "  move=" and return *this

    ~Timings() { delete[] elem; }

    int& operator[](int i) { return elem[i]; }
    int size() const { return sz; }
    int total() const {
        int sum {0};
        for (int i = 0; i < sz; ++i) {
            sum += elem[i];
        }
        return sum;
    }

private:
    int* elem;   // the minutes for each segment
    int sz;      // how many segments
};

Timings express_run(bool rush) {
    Timings rush_hour {2, 2, 3};
    Timings off_peak {3, 3, 4};
    if (rush) {
        return rush_hour;
    }
    return off_peak;
}

void print(const std::string& label, const Timings& t) {
    std::cout << label << ": " << t.size() << " segments, " << t.total() << " min\n";
}

int main() {
    std::cout << "a = express_run(true):\n";
    Timings a = express_run(true);
    print("a", a);

    std::cout << "b {std::move(a)}:\n";
    Timings b {std::move(a)};

    std::cout << "c = std::move(b):\n";
    Timings c {5};   // one 5-minute segment, replaced below
    c = std::move(b);

    print("a", a);
    print("b", b);
    print("c", c);
}
```

```cpp solution
#include <initializer_list>
#include <iostream>
#include <string>
#include <utility>

class Timings {
public:
    Timings(std::initializer_list<int> list)
        : elem{new int[list.size()]}, sz{static_cast<int>(list.size())} {
        int i {0};
        for (int m : list) {
            elem[i] = m;
            ++i;
        }
    }

    Timings(const Timings& t) : elem{new int[t.sz]}, sz{t.sz} {
        for (int i = 0; i < sz; ++i) {
            elem[i] = t.elem[i];
        }
        std::cout << "  copy\n";
    }

    Timings& operator=(const Timings& t) {
        int* p {new int[t.sz]};
        for (int i = 0; i < t.sz; ++i) {
            p[i] = t.elem[i];
        }
        delete[] elem;
        elem = p;
        sz = t.sz;
        std::cout << "  copy=\n";
        return *this;
    }

    Timings(Timings&& t) noexcept : elem{t.elem}, sz{t.sz} {
        t.elem = nullptr;
        t.sz = 0;
        std::cout << "  move\n";
    }

    Timings& operator=(Timings&& t) noexcept {
        delete[] elem;
        elem = t.elem;
        sz = t.sz;
        t.elem = nullptr;
        t.sz = 0;
        std::cout << "  move=\n";
        return *this;
    }

    ~Timings() { delete[] elem; }

    int& operator[](int i) { return elem[i]; }
    int size() const { return sz; }
    int total() const {
        int sum {0};
        for (int i = 0; i < sz; ++i) {
            sum += elem[i];
        }
        return sum;
    }

private:
    int* elem;   // the minutes for each segment
    int sz;      // how many segments
};

Timings express_run(bool rush) {
    Timings rush_hour {2, 2, 3};
    Timings off_peak {3, 3, 4};
    if (rush) {
        return rush_hour;
    }
    return off_peak;
}

void print(const std::string& label, const Timings& t) {
    std::cout << label << ": " << t.size() << " segments, " << t.total() << " min\n";
}

int main() {
    std::cout << "a = express_run(true):\n";
    Timings a = express_run(true);
    print("a", a);

    std::cout << "b {std::move(a)}:\n";
    Timings b {std::move(a)};

    std::cout << "c = std::move(b):\n";
    Timings c {5};   // one 5-minute segment, replaced below
    c = std::move(b);

    print("a", a);
    print("b", b);
    print("c", c);
}
```

Once it passes, change `return off_peak;` to `return rush_hour;` and tap **Run**. The first `move` disappears: the same local is returned on every path, so it's elided. (Check fails while the output differs.) Put it back.

The book's next section, 4.6.3 (p. 52), treats constructors, copies, moves and the destructor as one set: the essential operations.
