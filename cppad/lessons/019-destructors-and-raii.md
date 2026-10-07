---
id: 19
title: Destructors and RAII
concept: containers, destructors, delete[] in a destructor, when destructors run, reverse order of destruction, resource handles, handle-to-data model, RAII, naked new and delete, garbage collection
minutes: 14
source: A Tour of C++
source_pages: 36-38
---
# Destructors and RAII

Lesson 11 left a gap in the book's `Vector`: nothing ever `delete`s the doubles its constructor gets with `new`, so every Vector leaks (lesson 5). §4.2.2, near the bottom of p. 36, closes the gap.

A **container** is an object whose job is to hold other objects, its elements: `std::vector` is one, and so is the book's `Vector`. Apart from the leak, it's a decent one.

## Nobody tidies up for you

Many languages have a **garbage collector**, which now and then reclaims memory nothing uses any more. C++ doesn't promise you one, and you often want to decide exactly *when* something is released. So a class that takes memory must give it back itself, without its users having to remember: that's a destructor's job.

## The destructor

Here's lesson 11's Vector with the book's addition (p. 37):

```cpp
class Vector {
public:
    Vector(int s) : elem{new double[s]{}}, sz{s} { }   // get the elements
    ~Vector() { delete[] elem; }                         // give them back
    double& operator[](int i) { return elem[i]; }
    int size() const { return sz; }
private:
    double* elem;   // elem points to an array of sz doubles
    int sz;
};
```

- `~Vector()` is the **destructor**: the class name with a tilde, `~`, in front. `~` is the bitwise operator from lesson 3 that flips every bit, so the name is a small pun: the destructor undoes the constructor. It has no return type and no parameters, and a class has only one.
- It runs **automatically** when a Vector's lifetime ends (lesson 5). Nobody calls it by hand.
- Its body hands the array back with `delete[]`, the partner of `new[]` (lesson 10).

> 💡 `~` isn't on the app's key row. On the iPad keyboard, tap **.?123**, then **#+=**.

The `{}` in `new double[s]{}` sets all `s` doubles to 0 (lesson 6); the book zeroes them with a loop instead. Like the book's, this Vector leaves out lesson 16's size check.

Users of `Vector` do nothing: they make Vectors as local variables, like `int`s, and the memory comes and goes with them (the book's `fct`, p. 37).

## Watching destructors run

A destructor that prints something shows exactly when it runs. (Real destructors rarely print: this is for learning.) Tap **Open in editor** and **▶ Run**:

```cpp
#include <iostream>
#include <string>

class Light {
public:
    Light(const std::string& where) : name{where} {
        std::cout << name << ": on\n";
    }
    ~Light() {
        std::cout << name << ": off\n";
    }
private:
    std::string name;
};

void check_platform(bool closed) {
    Light lamp {"platform"};
    if (closed) {
        return;                     // leaving early
    }
    std::cout << "  trains running\n";
}

int main() {
    Light hall {"hall"};
    Light stairs {"stairs"};
    {
        Light booth {"booth"};
        std::cout << "  selling tickets\n";
    }
    check_platform(true);
    std::cout << "  closing\n";
}
```

```text
hall: on
stairs: on
booth: on
  selling tickets
booth: off
platform: on
platform: off
  closing
stairs: off
hall: off
```

Read it against the code:

- **At the end of its scope.** `booth` lives in the inner block, so it goes off at that block's `}`, before `main` carries on.
- **On every way out.** `check_platform` returns early, so `trains running` never prints, but `lamp` still goes off. Whichever way a function returns, its locals are destroyed. (A failed `assert` or a 💥 abort stops the program without running any destructors.)
- **Last made, first destroyed.** At the end of `main`, `stairs` goes before `hall`: objects in one scope are destroyed in **reverse order of construction**, because a later object may depend on an earlier one.

An object made with `new` belongs to no scope (lesson 5): its destructor runs when you `delete` it.

This is also lesson 15's cleanup: an exception unwinding out of a block runs the destructors of the block's objects.

## Handles, finished

Here's `Vector v(6);` in memory, the picture on p. 38:

```text
 v                     the free store
+-----------+
| elem:  o--+----> [ 0 | 0 | 0 | 0 | 0 | 0 ]
| sz:    6  |         0   1   2   3   4   5
+-----------+
```

Lesson 11 called `v` a handle. Now both halves are looked after. `v` is a local variable, so its scope takes care of it. The array has no scope, so the handle takes care of it: the constructor fetches it, the destructor returns it.

The book calls this the **handle-to-data model**. It suits data whose amount isn't known in advance or can change. This Vector's size is fixed, but a `std::vector` swaps its array for a bigger one as you `push_back` (lesson 6), and its handle stays the same size.

## RAII

Getting a resource in a constructor and releasing it in the destructor is called **RAII**, short for *Resource Acquisition Is Initialization*. A **resource** is anything you must get and later give back: free-store memory, an open file, a network connection (lesson 27 has more). A class like `Vector` that owns a resource this way is a **resource handle** (or *RAII handle*).

The name describes only the first half: you acquire a resource by initializing an object that owns it. The payoff is the other half: the destructor releases it on every way out of the scope, and the class's users write no cleanup at all.

RAII lets you get rid of **naked `new`**: a `new` out in ordinary code, instead of buried inside a class that manages what it gets. **Naked `delete`** goes with it. Compare:

```cpp
void naked(int n) {
    double* p {new double[n]{}};
    // ... use p ...
    if (n > 100) {
        return;          // leak: this way out skips the delete[]
    }
    delete[] p;          // needed on every way out, exactly once
}

void handled(int n) {
    Vector v(n);
    // ... use v ...
    if (n > 100) {
        return;          // fine: ~Vector() runs here
    }
}                        // ...and here
```

A naked `delete` must be reached exactly once on every path: miss it and you leak, reach it twice and it's undefined behaviour (lesson 2). With a handle, the compiler puts the cleanup on every path for you.

## Let the library do it

You'll rarely write a destructor like `~Vector()` yourself. `std::vector` and `std::string` are resource handles already, and `std::unique_ptr` (lesson 23) is one for a single object made with `new`. A class whose members all look after themselves (handles like these, or plain `int`s) needs no destructor: its members clean up when it dies. Lesson 11's `Train`, with its `std::string line`, never leaked a byte. When a class does have a destructor, its body runs before the members go: that's how `~Light()` could print `name`.

Write a destructor when your class holds a resource directly, through a plain pointer (lesson 8) like `elem`.

> ⚠️ **Don't copy a Vector yet.** `Vector b = a;` compiles but copies the members, so `b.elem` points to `a`'s array: change `b[0]` and `a[0]` changes too. At the end of the scope, both destructors `delete[]` the same array: undefined behaviour. Clang is silent even with `-Wall -Wextra`, and here the program doesn't even crash. Lesson 24 fixes copying. Until then, pass a class like this by reference (lesson 7), and never pass or return it by value.

## Exercise: Seat map

A `Seat_map` tracks one train car's seats: `taken[i]` is `true` once seat `i` is sold. The seats live on the free store, so `Seat_map` is a resource handle. `main` and `check_car` are written: `main` makes car 1, then car 2 in an inner block, then calls `check_car`, which makes car 3. In what order will they be freed? Decide, then write the two ends:

1. The constructor `Seat_map(int car, int seats)`. In the member initializer list, `car_number` gets `car`, `seat_count` gets `seats`, and `taken` gets `new bool[seats]{}` (all `false`: every seat free). In the body, print `car <car>: <seats> seats ready`.
2. The destructor: `delete[]` the seats, then print `car <car_number>: seats freed`. A destructor has no parameters, so it uses the member `car_number`.

Check your prediction:

```expected
car 1: 4 seats ready
car 2: 4 seats ready
car 2: 3 free
car 2: seats freed
car 3: 2 seats ready
car 3: 1 free
car 3: seats freed
car 1: 2 free
car 1: seats freed
```

The starter won't compile until the constructor exists: `no matching constructor for initialization of 'Seat_map'` (skip the candidate notes, as in lesson 11). Write it and run. Every car gets ready and none is freed: lesson 10's leak, made visible. A `private field 'car_number' is not used` warning is fine for now: the destructor will use it.

In the destructor, write `delete[]`, not `delete`: plain `delete` on an array from `new[]` is undefined behaviour, yet Clang only warns (`did you mean 'delete[]'?`) and Check still passes. Read the warnings.

```cpp starter
#include <iostream>

class Seat_map {
public:
    // TODO 1: the constructor Seat_map(int car, int seats)
    //         - member initializer list: car_number gets car,
    //           seat_count gets seats, taken gets new bool[seats]{}
    //         - body: print "car <car>: <seats> seats ready"

    // TODO 2: the destructor
    //         - delete[] the seats
    //         - print "car <car_number>: seats freed"

    void take(int seat) { taken[seat] = true; }

    int free_count() const {
        int count {0};
        for (int i = 0; i < seat_count; ++i) {
            if (!taken[i]) {
                ++count;
            }
        }
        return count;
    }

private:
    int car_number;    // which car of the train
    int seat_count;    // how many seats it has
    bool* taken;       // taken[i] is true once seat i is sold
};

void check_car() {
    Seat_map spare {3, 2};
    spare.take(0);
    std::cout << "car 3: " << spare.free_count() << " free\n";
}

int main() {
    Seat_map first {1, 4};
    first.take(0);
    first.take(3);
    {
        Seat_map second {2, 4};
        second.take(1);
        std::cout << "car 2: " << second.free_count() << " free\n";
    }
    check_car();
    std::cout << "car 1: " << first.free_count() << " free\n";
}
```

```cpp solution
#include <iostream>

class Seat_map {
public:
    Seat_map(int car, int seats)
        : car_number{car}, seat_count{seats}, taken{new bool[seats]{}} {
        std::cout << "car " << car_number << ": " << seat_count << " seats ready\n";
    }

    ~Seat_map() {
        delete[] taken;
        std::cout << "car " << car_number << ": seats freed\n";
    }

    void take(int seat) { taken[seat] = true; }

    int free_count() const {
        int count {0};
        for (int i = 0; i < seat_count; ++i) {
            if (!taken[i]) {
                ++count;
            }
        }
        return count;
    }

private:
    int car_number;    // which car of the train
    int seat_count;    // how many seats it has
    bool* taken;       // taken[i] is true once seat i is sold
};

void check_car() {
    Seat_map spare {3, 2};
    spare.take(0);
    std::cout << "car 3: " << spare.free_count() << " free\n";
}

int main() {
    Seat_map first {1, 4};
    first.take(0);
    first.take(3);
    {
        Seat_map second {2, 4};
        second.take(1);
        std::cout << "car 2: " << second.free_count() << " free\n";
    }
    check_car();
    std::cout << "car 1: " << first.free_count() << " free\n";
}
```

Car 2 is freed at the inner block's `}`, car 3 when `check_car` returns, and car 1 last, at the end of `main`, although it was made first.

Once it passes, add `Seat_map copy {first};` and `copy.take(1);` after `check_car();` and tap **Run**. You see `car 1: 1 free`: taking a seat in the copy took it in `first` too. And `car 1: seats freed` prints twice: one array, two `delete[]`s, the ⚠️ made visible, with no crash and no warning. Take the lines out again.
