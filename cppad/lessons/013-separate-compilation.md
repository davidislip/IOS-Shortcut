---
id: 13
title: Separate compilation
concept: interface and implementation, member functions defined outside the class, Class::member, header files, #include and the preprocessor, separate compilation, object files and linking, include guards, #pragma once, inline, duplicate symbols
minutes: 14
source: A Tour of C++
source_pages: 23-26
---
# Separate compilation

Chapter 3 of the book is about **modularity**: building a program out of parts (so far: functions and your own types) that can be written, understood and changed one at a time.

What keeps the parts manageable is a clear line between each part's interface, what its users need to know, and its implementation, how it does the job (lesson 11's words for a class, now for any part). In C++ an interface is a set of declarations. Lesson 2's `double sqrt(double);` is one: it gives the compiler everything it needs to check a call, while the body lives somewhere else. This lesson does the same for a class, then splits the two into files.

## Member functions defined outside the class

In lesson 11 every member function had its body inside the class. You can also just declare it there, and define it further down:

```cpp
#include <iostream>

class Turnstile {
public:
    void pass();     // declared here...
    int count();
private:
    int passes {0};
};

void Turnstile::pass() {    // ...and defined here
    ++passes;
}

int Turnstile::count() {
    return passes;
}

int main() {
    Turnstile north;
    north.pass();
    north.pass();
    std::cout << "north: " << north.count() << '\n';   // north: 2
}
```

`Turnstile::pass` means "the `pass` that belongs to `Turnstile`". It's the same `::` as in `std::cout` and `Signal::red` (lesson 12): the name on the left says where the name on the right lives. After `Turnstile::`, the body counts as part of the class: `passes` means this object's member, and private members are open to it.

- The return type still comes first: `int Turnstile::count()`. A constructor has none, so the class name appears twice, followed by any member initializer list. For lesson 11's Vector: `Vector::Vector(int s) : elem{new double[s]}, sz{s} { }`.
- The definition must match a declaration in the class. Define `int Turnstile::count(int hour)` and Clang says `out-of-line definition of 'count' does not match any declaration in 'Turnstile'` (*out-of-line* means outside the class). You can't add members from outside.

> 💡 Delete `Turnstile::` from the definition of `pass` and it becomes an ordinary function, unrelated to Turnstile. It can't see `passes`: `use of undeclared identifier 'passes'; did you mean 'pass'?` (the error after it follows from that guess).

## Header files

The book now splits lesson 11's Vector into files. The class, with its member functions only declared, goes in a file of its own, `Vector.h`:

```cpp
// Vector.h: Vector's interface
class Vector {
public:
    Vector(int s);
    double& operator[](int i);
    int size();
private:
    double* elem;   // elem points to an array of sz doubles
    int sz;
};
```

A file like this is a **header file**, your own `<cmath>`. Code that uses a Vector includes it:

```cpp
// user.cpp: uses Vector
#include "Vector.h"   // Vector's interface
#include <cmath>      // the library's math interface, with std::sqrt

double sqrt_sum(Vector& v) {   // the sum of the square roots
    double sum {0};
    for (int i = 0; i < v.size(); ++i) {
        sum += std::sqrt(v[i]);
    }
    return sum;
}

// ... plus main(), which makes a Vector and calls sqrt_sum
```

(The book writes `using namespace std;` and `!=`.) The definitions go in `Vector.cpp`, which includes its own header too:

```cpp
// Vector.cpp: Vector's implementation
#include "Vector.h"   // its own interface

Vector::Vector(int s) : elem{new double[s]}, sz{s} { }

double& Vector::operator[](int i) {
    return elem[i];
}

int Vector::size() {
    return sz;
}
```

Before compiling, a step called the **preprocessor** handles every line that starts with `#`: it replaces `#include "Vector.h"` with the whole text of `Vector.h`. The compiler then sees the class at the top of `user.cpp`: a header is just text that gets pasted in.

- **Quotes or angle brackets?** A name in `< >` is looked for among the library's headers. A name in quotes is looked for first next to the including file, then there too: use quotes for your own headers.
- **Why does `Vector.cpp` include its own header?** So the compiler can check that the two agree. Without the class in front of it, `Vector::` means nothing; with it, each definition is checked against its declaration.

Both `.cpp` files see the same header, and neither needs anything else from the other:

```text
                  Vector.h
             (Vector's interface)
             /                 \
  #include "Vector.h"     #include "Vector.h"
           /                     \
      user.cpp                Vector.cpp
    (uses Vector)          (defines Vector)
```

## Compiling separately

Each `.cpp` file is compiled on its own into an object file, and the linker joins them: lesson 1's picture, now with a reason behind it. In a real project the build looks like this (`-c` means "compile only, don't link"):

```text
$ clang++ -c Vector.cpp                # → Vector.o
$ clang++ -c user.cpp                  # → user.o
$ clang++ user.o Vector.o -o program   # link them into the program
```

While compiling `user.cpp`, the compiler sees only Vector's declarations. That's enough to check every use, and `user.o` records that it needs `Vector::size()` and the rest from somewhere. Link `user.o` on its own and you get lesson 2's error, `undefined symbol: Vector::size()` (a *symbol* is a name the linker must match with a body), and the same for every other member it uses.

Why go to this trouble?

- **Faster builds.** Change a body in `Vector.cpp` and only `Vector.cpp` is recompiled before linking again. But change `Vector.h` and every file that includes it must be recompiled, because its text is pasted into each. Adding or changing a private member counts too: it's in the header. (Lesson 21 shows the book's way around that.)
- **Enforced separation.** `user.cpp` sees only the header, so it can't come to rely on how `Vector.cpp` does its job: those bodies can change without breaking it.
- **Libraries.** You include `<cmath>` and call `std::sqrt` without writing its body: a library usually comes as headers plus already-compiled code. As the book puts it, a library is simply "other code we happen to use".

The book adds that separate compilation is about how compilers and build tools work, not the language. So first make the program modular with language features (functions, classes and, next, namespaces), then use files to compile it in pieces. (C++20 added *modules*, a newer way to split a program without pasting text; most code, including the book's, uses headers.)

## Include guards

Headers include other headers, so one `.cpp` file can end up with `Vector.h` twice: it includes `Vector.h` and `Matrix.h`, and `Matrix.h` includes `Vector.h` too. Then Vector is defined twice: `redefinition of 'Vector'`, with a note calling it an `unguarded header`. So every real header has an **include guard**, which tells the preprocessor to paste it into each `.cpp` file at most once. The standard form is three lines:

```cpp
// Vector.h
#ifndef VECTOR_H   // "if not defined": true the first time
#define VECTOR_H   // now it is defined
class Vector { … };
#endif             // a second paste skips everything up to here
```

Many headers use one line instead, `#pragma once`: not standard C++, but every major compiler accepts it.

## Function bodies in headers

> ⚠️ **A function body in a header.** Put `double sqrt_sum(Vector& v) { … }` in `Vector.h` and include that from two `.cpp` files: each object file gets its own copy, both compile fine, and then the linker stops with `duplicate symbol: sqrt_sum(Vector&)`, naming both object files. The include guard doesn't help: it only stops a second paste into the same `.cpp` file, and here each file gets its own. So declare the function in the header and define it in one `.cpp` file (the book's advice [5], p. 31).

Why don't lesson 11's classes hit this? A member function defined inside its class is **inline**: identical copies of it may turn up in many object files, and the linker keeps one. That's why a class with its bodies inside can live in a header. Writing `inline` in front of an ordinary function gets it the same deal (lesson 18 explains the name).

## One file in this app

This app compiles exactly one file, `main.cpp`: `#include "Vector.h"` stops with `fatal error: 'Vector.h' file not found`. So when an example has "files", they sit one after another in `main.cpp`, each under a comment banner, header first:

```cpp
// ===== Vector.h =====
class Vector { … };

// ===== Vector.cpp =====
Vector::Vector(int s) : …

// ===== user.cpp =====
double sqrt_sum(Vector& v) { … }
// … and main
```

The header appears only once, so skip the include guard (`#pragma once` in `main.cpp` even makes Clang warn).

## Exercise: Bike dock, split in two

A bike-share dock has some slots, and some of them hold bikes. Its invariant: never fewer than 0 bikes, never more bikes than slots. (The constructor trusts its arguments for now; lesson 16 shows how a constructor can check them.) The starter's `main.cpp` holds three "files": `Dock.h` and `user.cpp` are written, `Dock.cpp` is empty. Write the five definitions there, each with `Dock::`:

1. The constructor `Dock(int slots, int parked)`: with a member initializer list, `slot_count` gets `slots` and `bike_count` gets `parked`.
2. `bool take()`: if no bike is left, return `false` and change nothing. Otherwise the dock has one bike fewer; return `true`.
3. `bool give_back()`: if every slot holds a bike, return `false`. Otherwise one bike more; return `true`.
4. `int bikes()` returns `bike_count`; `int free_slots()` returns the number of empty slots.

Starting with 2 bikes in 4 slots, `main` tries to take three bikes, then to return five:

```expected
take: ok, bikes 1, free 3
take: ok, bikes 0, free 4
take: none left
return: ok, bikes 1, free 3
return: ok, bikes 2, free 2
return: ok, bikes 3, free 1
return: ok, bikes 4, free 0
return: dock full
```

The starter compiles, but it doesn't link:

```text
wasm-ld: error: /tmp/main-….o: undefined symbol: Dock::Dock(int, int)
wasm-ld: error: /tmp/main-….o: undefined symbol: Dock::take()
…
```

That's lesson 2's linker error: `user.cpp` compiled happily from the header alone, and now there are no bodies to link. Each definition you write takes its name off the list.

```cpp starter
// ===== Dock.h: the interface =====
class Dock {
public:
    Dock(int slots, int parked);   // parked: bikes in the dock at the start
    bool take();         // a rider takes a bike; false if none is left
    bool give_back();    // a rider returns one; false if the dock is full
    int bikes();         // bikes in the dock
    int free_slots();    // empty slots
private:
    int slot_count;
    int bike_count;
};

// ===== Dock.cpp: the implementation =====
// (a real Dock.cpp would start with #include "Dock.h")

// TODO 1: Dock::Dock(int slots, int parked), with a member initializer list
// TODO 2: bool Dock::take()
// TODO 3: bool Dock::give_back()
// TODO 4: int Dock::bikes() and int Dock::free_slots()

// ===== user.cpp: uses a Dock =====
// (a real user.cpp would start with #include "Dock.h")
#include <iostream>

void show(Dock& d) {   // not const Dock&: bikes() isn't const (lesson 11's tip)
    std::cout << "bikes " << d.bikes() << ", free " << d.free_slots() << '\n';
}

int main() {
    Dock dock {4, 2};   // 4 slots, 2 of them holding bikes
    for (int i = 0; i < 3; ++i) {
        if (dock.take()) {
            std::cout << "take: ok, ";
            show(dock);
        } else {
            std::cout << "take: none left\n";
        }
    }
    for (int i = 0; i < 5; ++i) {
        if (dock.give_back()) {
            std::cout << "return: ok, ";
            show(dock);
        } else {
            std::cout << "return: dock full\n";
        }
    }
}
```

```cpp solution
// ===== Dock.h: the interface =====
class Dock {
public:
    Dock(int slots, int parked);   // parked: bikes in the dock at the start
    bool take();         // a rider takes a bike; false if none is left
    bool give_back();    // a rider returns one; false if the dock is full
    int bikes();         // bikes in the dock
    int free_slots();    // empty slots
private:
    int slot_count;
    int bike_count;
};

// ===== Dock.cpp: the implementation =====
// (a real Dock.cpp would start with #include "Dock.h")

Dock::Dock(int slots, int parked) : slot_count{slots}, bike_count{parked} { }

bool Dock::take() {
    if (bike_count == 0) {
        return false;             // none left: nothing changes
    }
    --bike_count;
    return true;
}

bool Dock::give_back() {
    if (bike_count == slot_count) {
        return false;             // every slot is full
    }
    ++bike_count;
    return true;
}

int Dock::bikes() {
    return bike_count;
}

int Dock::free_slots() {
    return slot_count - bike_count;
}

// ===== user.cpp: uses a Dock =====
// (a real user.cpp would start with #include "Dock.h")
#include <iostream>

void show(Dock& d) {   // not const Dock&: bikes() isn't const (lesson 11's tip)
    std::cout << "bikes " << d.bikes() << ", free " << d.free_slots() << '\n';
}

int main() {
    Dock dock {4, 2};   // 4 slots, 2 of them holding bikes
    for (int i = 0; i < 3; ++i) {
        if (dock.take()) {
            std::cout << "take: ok, ";
            show(dock);
        } else {
            std::cout << "take: none left\n";
        }
    }
    for (int i = 0; i < 5; ++i) {
        if (dock.give_back()) {
            std::cout << "return: ok, ";
            show(dock);
        } else {
            std::cout << "return: dock full\n";
        }
    }
}
```

Once it passes, move one body back into the class: in `Dock.h`, replace `int bikes();` with `int bikes() { return bike_count; }`, and run. Clang says `redefinition of 'bikes'`: there are two bodies now. Delete `Dock::bikes` from `Dock.cpp` and it works again: `bikes` is now defined in the class, like lesson 11's functions, and so it's inline.
