---
id: 10
title: Structures
concept: built-in and user-defined types, struct, members, the . and -> operators, passing a struct by reference, returning a struct, default member initializers, the free store and new
minutes: 13
source: A Tour of C++
source_pages: 15-17
---
# Structures

Chapter 2 of the book is about making your own types. Apart from `std::string` and `std::vector`, every type you've used so far is *built-in*: the fundamental types from lesson 3 (`int`, `double`, `char`…), plus what `const` and the declarator operators `[ ]`, `*` and `&` make of them (lessons 5–8). They're deliberately low-level: numbers, characters and addresses, the things the hardware itself works with.

A program about the subway would rather talk about trains and trips. Lesson 4 called types written in ordinary C++ *user-defined types*: `std::string` and `std::vector` are two of them, written by the library's authors. Now you'll write your own. There are two kinds: **classes**, starting with the simple `struct` in this lesson and `class` in lesson 11, and **enumerations** (lesson 12).

## A first struct

A **struct** (short for *structure*) bundles a few values that belong together into one new type:

```cpp
#include <iostream>
#include <string>

struct Train {
    std::string line;   // which line it runs on
    int cars;           // how many cars it has
};

int main() {
    Train t {"Yonge", 6};                  // line = "Yonge", cars = 6
    std::cout << t.line << " line, " << t.cars << " cars\n";

    t.cars = 4;                            // a member is an ordinary variable
    std::cout << t.cars << " cars now\n";
}
```

This prints `Yonge line, 6 cars`, then `4 cars now`.

- `struct Train { … };` defines a new type called `Train`. It doesn't create a train yet: it describes what every `Train` contains.
- The variables declared inside are its **members**. Every `Train` object has its own `line` and its own `cars`.
- `Train t {"Yonge", 6};` creates a `Train` called `t`. The values in `{}` go to the members in the order they're declared.
- `t.line` means "the `line` member of `t`". You've used this dot before: `waits.size()` in lesson 6 calls a member *function* of a `std::vector` (lesson 11 shows how to write your own).

`Train` is now a type like `int`: you can use it for variables, parameters and return values, or make a `std::vector<Train>`.

That's the real gain. Lesson 9 tracked a position with two separate ints, `x` and `y`. They belong together, so bundle them: `struct Point { int x; int y; };`. Now a function can take one `Point` instead of two ints, and it can *return* a whole `Point`. A function returns only one value, so with two loose ints it couldn't hand back both.

> 💡 A struct definition ends with `};`. Forget the `;` and Clang stops with "expected ';' after struct". Starting your own type names with a capital letter (`Train`, `Trip`) is a common habit, and the book's.

## The book's `Vector`: elements kept elsewhere

The book's first struct (p. 16) is a home-made vector of doubles:

```cpp
struct Vector {
    int sz;         // how many doubles
    double* elem;   // where they are
};
```

A `Vector` doesn't contain its elements. It holds how many there are, `sz`, and a pointer to where they are, `elem` (lesson 8). To give it some elements, the book writes a function that fills a `Vector` in:

```cpp
void vector_init(Vector& v, int s) {
    v.elem = new double[s];   // room for s doubles, on the free store
    v.sz = s;
}
```

- `Vector& v` is a reference (lesson 7), so `vector_init` fills in the caller's `Vector`, not a copy. Passing a struct by `&` is how a function fills one in or changes it.
- `new double[s]` sets aside memory for `s` doubles and returns a pointer to the first one. That memory comes from the **free store**, which you'll also hear called the **heap** or *dynamic memory*. Like the `new` object in lesson 5, it isn't tied to any scope: it stays taken until the program hands it back. For an array made with `new[]`, that's `delete[]`, not plain `delete`.

Here's a use of it: read `s` numbers and add them up. (The book's loops test `i!=s`; these lessons use `<`, as in lesson 6.)

```cpp
double read_and_sum(int s) {
    Vector v;
    vector_init(v, s);                // v now points to s doubles
    for (int i = 0; i < s; ++i) {
        std::cin >> v.elem[i];   // element i, counting from where elem points
    }
    double sum {0.0};
    for (int i = 0; i < s; ++i) {
        sum += v.elem[i];
    }
    return sum;
}
```

`v.elem[i]` works on a pointer just as on an array: it means `*(v.elem + i)`, the double `i` places after the one `elem` points to (lesson 8's `p + 2`). Called as `read_and_sum(4)` with the input `1.5 2 3.25 4`, it returns 10.75, and memory looks like this:

```text
 v                     the free store
+-----------+
| sz:   4   |
| elem:  o--+----> [ 1.5 | 2 | 3.25 | 4 ]
+-----------+
```

`v` itself is small and always the same size, an `int` and an address, whether it points to 4 doubles or 4 million. Lesson 11 comes back to this idea.

It works, but everyone who uses `Vector` must know its insides: call `vector_init` first, keep `sz` right, index through `elem`. And nothing ever gives the doubles back, so every call of `read_and_sum` loses `s` doubles of memory until the program ends: a memory leak (lesson 5). The book improves `Vector` step by step (a constructor in lesson 11; a destructor that returns the memory in §4.2.2).

`std::vector` is the finished version of this idea: it keeps its elements on the free store, knows its size, grows with `push_back` and gives the memory back by itself. That's why the book advises, on p. 17, not to reinvent `vector` or `string`. It builds `Vector` only to show how such types work. In your own code, use `std::vector`.

## Initialize every member

> ⚠️ Take the first `Train` again, with its plain `int cars;`. `Train t;` compiles, and `t.line` is empty (a string initializes itself), but `t.cars` is **uninitialized**: garbage, exactly like `int count;` in lesson 4. Members of type `int`, `double` or pointer get no value unless you give them one. In a test with this app, `std::cout << t.cars;` printed 65520, and Clang gave no warning. The garbage may even happen to be 0, which hides the bug. The book's `Vector v;` is worse: forget `vector_init`, and `std::cin >> v.elem[i]` stores numbers wherever the garbage address points.

Two fixes. First, `{}` when you create the object: `Vector v {};` sets `sz` to 0 and `elem` to `nullptr`, because empty braces mean zero, like `int count {};` in lesson 4.

Better, give each member a **default member initializer** in the struct itself. Then no object can ever start with garbage:

```cpp
struct Vector {
    int sz {0};               // starts empty...
    double* elem {nullptr};   // ...with no elements (lesson 8)
};

Vector v;                     // sz is 0, elem is nullptr
```

`int sz = 0;` works too. Values you give when creating an object still win: if `Train` had `int cars {0};`, then `Train t {"Yonge", 6};` would still have 6 cars, and a plain `Train t;` would have 0. Leave out a value, as in `Train k {"King"};`, and that member gets its default. (With no default it gets 0, but Clang warns: "missing field 'cars' initializer".)

Members of type `std::string` or `std::vector` are always safe: they initialize themselves to empty (lessons 4 and 6). So a struct made only of those needs nothing extra.

## `.` and `->`

Which operator you need depends on what you're holding. An object, or a reference to one, takes `.`. A pointer to one takes `->`:

```cpp
#include <iostream>
#include <string>

struct Train {
    std::string line;
    int cars {0};
};

void add_car(Train& t) {   // t is the caller's Train, not a copy
    ++t.cars;              // . through a reference
}

int main() {
    Train yonge {"Yonge", 6};
    add_car(yonge);
    std::cout << yonge.cars << '\n';    // 7: . through the name

    Train* p {&yonge};                  // p points to yonge (lesson 8)
    std::cout << p->cars << '\n';       // 7: -> through a pointer
    std::cout << (*p).cars << '\n';     // 7: what p->cars means
}
```

`p->cars` is short for `(*p).cars`: take the object `p` points to (`*p`), then its `cars` member. The parentheses matter, because `.` is applied before `*`. Write `*p.cars` and Clang asks: "member reference type 'Train *' is a pointer; did you mean to use '->'?" (plus a second error about `*`, which the same fix removes). Nobody writes `(*p).cars`: that's what `->` is for.

The book's `f(Vector v, Vector& rv, Vector* pv)` on p. 17 puts the three ways of reaching a member side by side: `v.sz` on an object (here a copy, passed by value), `rv.sz` through a reference, `pv->sz` through a pointer.

Dots chain left to right: `trip.minutes.size()` is the `size()` of the `minutes` member of `trip`. Through a pointer, it's `p->minutes.size()`.

Passing a struct to a function follows lessons 7 and 8:

- `const Train&` to read it without copying. A struct holding a long string or a big vector is expensive to copy.
- `Train&` to change it or fill it in, like `add_car` and `vector_init`.
- `const Train*` when there might be no train at all: check for `nullptr` before using `->` (lesson 8).

## Exercise: Trip record

The starter defines a `Trip`: the line's name, plus the minutes each segment of the ride took. Write:

1. `Trip read_trip(int segments)`: create a `Trip`, read the line name into its `line`, then read `segments` whole numbers, adding each one to the end of its `minutes` with `push_back`. Then return the whole `Trip`. `vector_init` filled in the caller's object through a `&`; this function builds its own and hands it back, the gain the `Point` example promised.
2. `int longest(const Trip& t)`: return the minutes of the longest segment. Keep the longest so far in an `int` that starts at 0 (no segment is shorter), declared before the loop like lesson 6's running total. In a range-for, use an `if` (lesson 8) to replace it whenever a segment is longer.
3. `void print_trip(const Trip* p)`: if `p` is `nullptr`, print `no trip`. Otherwise use `->` to print `<line>: <number of segments> segments, longest <minutes> minutes`.

On **Run**, type `Yonge 3 2 5 2` in the terminal and press return; **Check** feeds it in for you (lesson 9).

```stdin
Yonge 3 2 5 2
```

```expected
Yonge: 4 segments, longest 5 minutes
no trip
```

Hints: `t.minutes.push_back(m)` chains two dots. `longest` wants a `Trip`, and inside `print_trip` that's `*p`. `.size()` can go straight into `<<`.

The starter won't compile until the three functions exist. That's normal: read the first error, fix it, repeat.

```cpp starter
#include <iostream>
#include <string>
#include <vector>

struct Trip {
    std::string line;           // e.g. "Yonge"
    std::vector<int> minutes;   // minutes for each segment
};

// TODO: Trip read_trip(int segments)

// TODO: int longest(const Trip& t)

// TODO: void print_trip(const Trip* p)

int main() {
    Trip t {read_trip(4)};   // read_trip hands back a whole Trip
    print_trip(&t);
    print_trip(nullptr);
}
```

```cpp solution
#include <iostream>
#include <string>
#include <vector>

struct Trip {
    std::string line;           // e.g. "Yonge"
    std::vector<int> minutes;   // minutes for each segment
};

Trip read_trip(int segments) {
    Trip t;                     // line and minutes start empty
    std::cin >> t.line;
    for (int i = 0; i < segments; ++i) {
        int m {0};
        std::cin >> m;
        t.minutes.push_back(m);
    }
    return t;                   // the whole Trip goes back to the caller
}

int longest(const Trip& t) {
    int best {0};               // no segment is shorter than 0 minutes
    for (auto m : t.minutes) {
        if (m > best) {
            best = m;
        }
    }
    return best;
}

void print_trip(const Trip* p) {
    if (p == nullptr) {
        std::cout << "no trip\n";
    } else {
        std::cout << p->line << ": " << p->minutes.size() << " segments, longest "
                  << longest(*p) << " minutes\n";
    }
}

int main() {
    Trip t {read_trip(4)};   // read_trip hands back a whole Trip
    print_trip(&t);
    print_trip(nullptr);
}
```

Once it passes, add a second trip without reading anything: `Trip bloor {"Bloor", {4, 2, 3}};`, then `print_trip(&bloor);`. The inner `{}` initializes the vector member. (Check will fail after that, since the output has changed.)
