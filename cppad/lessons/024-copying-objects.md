---
id: 24
title: Copying objects
concept: memberwise copy, copy initialization, copy assignment, resource handles, shallow and deep copies, copy constructor, self-assignment, const overload of operator[], members that copy themselves, the rule of three
minutes: 14
source: A Tour of C++
source_pages: 48-50
---
# Copying objects

Lessons 19 and 20 kept warning you: don't copy a `Vector` yet. Section 4.6, halfway down p. 48, explains why, and how a class decides what a copy means.

## Member by member

Unless a class says otherwise, its objects can be copied, just like `int`s. The default is **memberwise copy**: each member of the new object is copied from the same member of the old one. Tap **Open in editor** and **▶ Run**:

```cpp
#include <iostream>
#include <string>

struct Stop {
    std::string name;
    int minutes {0};
};

int main() {
    Stop a {"Union", 0};
    Stop b {a};              // b starts life as a copy of a
    Stop c {"Finch", 24};
    c = a;                   // c already exists: its values are replaced by a's
    b.name += " Station";
    c.minutes = 5;
    std::cout << a.name << ", " << a.minutes << " min\n";
    std::cout << b.name << ", " << b.minutes << " min\n";
    std::cout << c.name << ", " << c.minutes << " min\n";
}
```

```text
Union, 0 min
Union Station, 0 min
Union, 5 min
```

Two kinds of copy happen here:

- `Stop b {a};` is what the book calls **copy initialization**: a new object starts life as a copy. `Stop b = a;` does the same, and so does passing `a` by value (lesson 2). (The C++ standard keeps that name for the `=` form, argument passing and returns; lesson 26 shows why it matters.)
- `c = a;` is **copy assignment**: `c` already exists, with values of its own, and they get replaced.

Each member copies the way its own type does: an `int` copies its bits, and a `std::string`, though it's a handle (lesson 19), copies its characters into memory of its own. For simple concrete types like lesson 18's `Money` and `complex`, memberwise copy is exactly right: a copy of $3.25 is another $3.25. For a concrete type that holds memory through a pointer, like `Vector`, it's wrong (next section). For classes in a hierarchy (lessons 21–23) it almost never is; lesson 27 shows why.

## When a member is a pointer

Now lesson 20's `Vector`. Its members are `elem`, a pointer, and `sz`. Memberwise copy copies the pointer, not the doubles it points to. The book's example on p. 49:

```cpp
void bad_copy(Vector v1) {
    Vector v2 = v1;   // copies v1's members: elem and sz
    v1[0] = 2;        // v2[0] is now 2 too!
    v2[1] = 3;        // v1[1] is now 3 too!
}
```

Say `v1` held four zeros. Afterwards:

```text
 v1                        the free store
+-----------+
| elem:  o--+---+
| sz:    4  |   |
+-----------+   +----> [ 2 | 3 | 0 | 0 ]
 v2             |
+-----------+   |
| elem:  o--+---+
| sz:    4  |
+-----------+
```

That's a **shallow copy**: two handles, one array. Lesson 19 called a class like `Vector` a resource handle: it owns something it can only reach through a pointer. Two owners of one array go wrong three ways:

- **Changes show up in both.** `v1` and `v2` look like two Vectors but share their elements.
- **The invariant breaks.** Lesson 16's "`elem` points to an array of `sz` doubles" really means an array that this Vector alone looks after. Now two do.
- **The array is deleted twice.** When `bad_copy` ends, `~Vector()` runs for `v2`, then for `v1`, and both `delete[]` the same array: undefined behaviour (lesson 2).

Worse, `v1` was itself passed by value: the caller's Vector shares the array too, and will `delete[]` it a third time.

The book calls a destructor a strong hint that memberwise copy is wrong, and wants at least a warning. Clang gives none (lesson 19's ⚠️), so decide what a copy means for every class you design, above all one with a destructor.

What `Vector` needs is a **deep copy**: a new array for the copy, with the elements copied into it.

## The copy constructor

A class defines copying with two members. The book adds them to `Vector` on p. 49:

```cpp
class Vector {
public:
    // ... as in lesson 20, plus:
    Vector(const Vector& a);                 // copy constructor
    Vector& operator=(const Vector& a);      // copy assignment
    const double& operator[](int i) const;   // for const Vectors: see below
private:
    double* elem;   // elem points to an array of sz doubles
    int sz;
};
```

The **copy constructor** is a constructor whose parameter is a `const` reference to its own type. It runs whenever a new Vector is made from an existing one: `Vector b {a};`, `Vector b = a;`, or passing `a` by value.

You've met the name twice: lesson 11's candidate notes listed the memberwise one C++ writes for a class without its own, and lesson 23's error said `std::unique_ptr`'s is *deleted*, so a unique_ptr can't be copied at all.

Here's the book's for `Vector`, defined outside the class (lesson 13):

```cpp
Vector::Vector(const Vector& a)       // copy constructor
    : elem{new double[a.sz]},         // an array of its own
      sz{a.sz}
{
    for (int i = 0; i < sz; ++i) {    // copy the elements
        elem[i] = a.elem[i];
    }
}
```

- The parameter is a reference: taking a `Vector` by value would need a copy to make a copy. Clang refuses: `copy constructor must pass its first argument by reference`.
- It's `const`: copying reads the original and never changes it.
- `a.sz` and `a.elem` are private members of *another* Vector. That's allowed, as in lesson 18's `+=`.
- It's `new double[a.sz]`, not `sz`: members are initialized in declaration order (lesson 11), `elem` first, so `sz` has no value yet. Clang warns: `field 'sz' is uninitialized when used here`.

Now `bad_copy` does what it looks like it does:

```text
 v1                     the free store
+-----------+
| elem:  o--+----> [ 2 | 0 | 0 | 0 ]
| sz:    4  |
+-----------+
 v2
+-----------+
| elem:  o--+----> [ 0 | 3 | 0 | 0 ]
| sz:    4  |
+-----------+
```

## Copy assignment

Assignment is a different job: the target already exists, and already owns an array. Careful: despite the `=`, `Vector b = a;` isn't an assignment. `b` is new, so the copy constructor runs; `operator=` is for a later `b = a;`.

The book's copy assignment (p. 50):

```cpp
Vector& Vector::operator=(const Vector& a)   // copy assignment
{
    double* p {new double[a.sz]};      // 1. a new array
    for (int i = 0; i < a.sz; ++i) {   // 2. copy the elements into it
        p[i] = a.elem[i];
    }
    delete[] elem;                     // 3. give back the old elements
    elem = p;                          // 4. take over the new ones
    sz = a.sz;
    return *this;
}
```

- Step 3 is what the copy constructor doesn't need: a new object owns nothing yet. Leave it out and every assignment leaks the old array.
- It returns `*this`, the object assigned to, as a reference, like lesson 18's `+=`. That makes `x = y = z;` work as it does for `int`s.

The order matters too. An object can be assigned to itself, usually by accident: `routes[i] = routes[j];` when `i` and `j` are equal. Then `a` *is* `*this`. Delete the old elements first, and you've deleted the elements you were about to copy. New array first, delete second, and this **self-assignment** is harmless.

With both operations written, copying a Vector is safe: lesson 19's warning is lifted, though a `const&` is still cheaper for passing one in.

## A `const` version of `[ ]`

`Vector` now has two `operator[]`s. Lesson 20's returns `double&`, so `v[i] = 7;` changes an element. But it isn't `const`, so it can't be called on a `const Vector&` (lesson 18): a function like `print(const Vector& v)` couldn't even read `v[i]`.

The new one is marked `const` and returns a `const double&`: you can read the element through it, but not assign to it. This is overloading (lesson 2) on whether the object is `const`: a `const` object gets the `const` version, any other gets the first.

## Let the members copy themselves

You won't often write copy operations. When every member copies itself correctly, memberwise copy is correct too. Lesson 20's `Timetable` keeps its times in a `std::vector<int>`: copying a Timetable copies the vector, which makes its own deep copy, as `auto backup = waits;` did in lesson 6. No code needed. Lesson 27 comes back to this as the *rule of zero*.

Write copy operations when your class holds a resource through a raw pointer, like `elem`. Then it needs both, plus a destructor: the three come as a set, often called the **rule of three** (lesson 27 makes it five).

> ⚠️ **One without the other.** Write only the copy constructor, and assignment stays memberwise: the compiler writes the missing one, shallow, and in a class with a destructor, like `Vector`, Clang says nothing. `Vector b = a;` makes a real copy, and a later `b = a;` shares the array again.

Copying a big container takes time, and often the original is about to vanish anyway. Lesson 25 is about *moving* it instead.

## Exercise: Route timings

`Timings` holds the minutes each segment of a route takes, in an array from `new int[n]`. Everything is written except the copy operations:

1. The copy constructor `Timings(const Timings& t)`, like `Vector`'s above: a new array of `t.sz` ints, then copy the elements.
2. The copy assignment `Timings& operator=(const Timings& t)`, like `Vector`'s: new array first, `delete[]` the old one second.

In `main`, `detour` is made as a copy of `weekday`, `express` is assigned one, and each copy then changes one segment:

```expected
weekday: 3 2 4 (9 min)
detour: 3 7 4 (14 min)
express: 1 2 4 (7 min)
```

Run the starter first. It compiles without a warning and prints `1 7 4 (12 min)` three times: one array, three handles, and every change shows up in all of them. (`express`'s own `{2, 2}` array leaked when it was assigned.)

Do TODO 1 and run again. `detour` has its own array now, but `express` still shares `weekday`'s, and both print `1 2 4`: that's the ⚠️ above. TODO 2 fixes it.

```cpp starter
#include <initializer_list>
#include <iostream>
#include <string>

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

    // TODO 1: the copy constructor Timings(const Timings& t)
    //         - member initializer list: elem gets new int[t.sz],
    //           sz gets t.sz
    //         - body: copy each element of t.elem into elem

    // TODO 2: the copy assignment Timings& operator=(const Timings& t)
    //         - a new array of t.sz ints; copy t's elements into it
    //         - delete[] the old elements
    //         - elem and sz take over the new array and t.sz
    //         - return *this

    ~Timings() { delete[] elem; }

    int& operator[](int i) { return elem[i]; }
    const int& operator[](int i) const { return elem[i]; }
    int size() const { return sz; }

    int total() const {
        int sum {0};
        for (int i = 0; i < sz; ++i) {
            sum += elem[i];
        }
        return sum;
    }

private:
    int* elem;   // elem points to an array of sz segment times, in minutes
    int sz;
};

void print(const std::string& label, const Timings& t) {
    std::cout << label << ':';
    for (int i = 0; i < t.size(); ++i) {
        std::cout << ' ' << t[i];            // the const operator[]
    }
    std::cout << " (" << t.total() << " min)\n";
}

int main() {
    Timings weekday {3, 2, 4};
    Timings detour = weekday;               // copy initialization
    detour[1] = 7;                          // a road closure on segment 2
    Timings express {2, 2};
    express = weekday;                      // copy assignment
    express[0] = 1;                         // skips a stop on segment 1
    print("weekday", weekday);
    print("detour", detour);
    print("express", express);
}
```

```cpp solution
#include <initializer_list>
#include <iostream>
#include <string>

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
    }

    Timings& operator=(const Timings& t) {
        int* p {new int[t.sz]};             // new array first...
        for (int i = 0; i < t.sz; ++i) {
            p[i] = t.elem[i];
        }
        delete[] elem;                      // ...then give back the old one
        elem = p;
        sz = t.sz;
        return *this;
    }

    ~Timings() { delete[] elem; }

    int& operator[](int i) { return elem[i]; }
    const int& operator[](int i) const { return elem[i]; }
    int size() const { return sz; }

    int total() const {
        int sum {0};
        for (int i = 0; i < sz; ++i) {
            sum += elem[i];
        }
        return sum;
    }

private:
    int* elem;   // elem points to an array of sz segment times, in minutes
    int sz;
};

void print(const std::string& label, const Timings& t) {
    std::cout << label << ':';
    for (int i = 0; i < t.size(); ++i) {
        std::cout << ' ' << t[i];            // the const operator[]
    }
    std::cout << " (" << t.total() << " min)\n";
}

int main() {
    Timings weekday {3, 2, 4};
    Timings detour = weekday;               // copy initialization
    detour[1] = 7;                          // a road closure on segment 2
    Timings express {2, 2};
    express = weekday;                      // copy assignment
    express[0] = 1;                         // skips a stop on segment 1
    print("weekday", weekday);
    print("detour", detour);
    print("express", express);
}
```

Once it passes, try the other order. Move `delete[] elem;` to the top of your `operator=`, add `weekday = weekday;` after `express[0] = 1;`, and tap **Run**. Clang warns `explicitly assigning value of variable of type 'Timings' to itself` (it can't spot `routes[i] = routes[j];`), and `weekday` prints garbage: its elements were given back before they were copied. Put your order back and remove the line.
