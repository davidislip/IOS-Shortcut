---
id: 27
title: Resource management and the rule of zero
concept: resources, strong resource safety, holding resources too long, resource handles instead of pointers, smart pointers, garbage collection, RAII in the standard library, = delete, slicing, move-only classes, the rule of zero, the rule of five
minutes: 15
source: A Tour of C++
source_pages: 54-58
---
# Resource management and the rule of zero

Lesson 26 left you with a choice: declare all five (the destructor and the four copy and move operations), or none. Chapter 4's last two sections (pp. 54–55) show why "none" is usually right, and how to switch an operation off for objects that must never be copied.

## Resources, not just memory

Lesson 19 called a resource anything you must get and later give back. You've used one: memory from the free store. Programs outside this app juggle others: open files (the system allows only so many), network connections (called **sockets**), **threads** (extra lines of work running at the same time) and **locks** (flags that let one thread use something shared while the others wait). Same pattern every time: get it, use it, give it back, exactly once.

The book's goal is **strong resource safety**: no leaks of any kind of resource. In a server running for months, small leaks add up until nothing is left. Holding on too long is nearly as bad: a program that keeps every file open until it exits can run out of files without leaking one.

## Handles instead of pointers

The book's example (p. 54) needs threads, so it can't run here:

```cpp
std::vector<std::thread> my_threads;

Vector init(int n) {
    std::thread t {heartbeat};            // run heartbeat() on a thread of its own
    my_threads.push_back(std::move(t));   // hand the thread over to the vector
    Vector vec(n);
    for (int i = 0; i < vec.size(); ++i) {
        vec[i] = 777;
    }
    return vec;                           // moved out, or elided (lesson 25)
}

auto v = init(10000);
```

Nothing is copied: a thread can't be, and 10,000 doubles shouldn't be. The thread is moved into `my_threads`, and `return vec;` moves the Vector out or, with lesson 25's elision, builds it in `v` from the start.

So a function can return a handle instead of a pointer. Compare what these tell the caller:

```cpp
// two designs for the same function (not one program):
int* departures(int route);                // who delete[]s this? how many are there?
std::vector<int> departures(int route);    // the vector owns them and knows its size

// lesson 23's factory:
std::unique_ptr<Vehicle> make_vehicle(const std::string& kind, int n);
```

The first leaves questions its type can't answer. The other two return handles: the caller owns the result, and cleanup happens by itself. `std::unique_ptr` is a **smart pointer**, a handle that works like a pointer (`->`, `*`) but owns what it points to. Lesson 19 moved `new` and `delete` into constructors and destructors; handles do the same for owning pointers, and are normally no slower.

## Not a garbage collector

C++11 added a way to plug in a garbage collector (lesson 19), but the book calls garbage collection the last resort. Memory isn't the only resource: a collector that frees memory some time later is no help with a file that must be closed now. No major compiler ever put a collector behind that interface, and C++23 removed it.

The C++ way is RAII (lesson 19): every resource belongs to an object (its owner, lesson 23), and when that object's lifetime ends, its destructor gives the resource back. To make a resource outlive its scope, return its handle, as `departures` and `make_vehicle` do above.

The standard library works this way throughout:

| Resource | Handles that own it |
|---|---|
| memory for elements or text | `std::vector`, `std::string` |
| one object on the free store | `std::unique_ptr`, `std::shared_ptr` |
| an open file | `std::ifstream`, `std::ofstream` |
| a thread | `std::jthread` (C++20) |
| a lock | `std::scoped_lock` (C++17; the book: `lock_guard`), `std::unique_lock` |

Use them and you never write the release: each handle's destructor does it. The book lists `std::thread` instead, which breaks the pattern: you must call its `join()` (wait for the thread to finish) yourself, or destroying it stops the whole program. A `std::jthread` joins in its destructor.

## Switching an operation off: `= delete`

Section 4.6.5 is about objects that shouldn't be copied at all, starting with a base class in a hierarchy. Tap **Open in editor** and **▶ Run**:

```cpp
#include <iostream>

class Vehicle {
public:
    virtual void describe() const { std::cout << "a vehicle\n"; }
    virtual ~Vehicle() = default;
};

class Train : public Vehicle {
public:
    explicit Train(int n) : car_count{n} { }
    void describe() const override {
        std::cout << "a train of " << car_count << " cars\n";
    }
private:
    int car_count;
};

void show(Vehicle v) {    // by value: v is a new Vehicle, copied from the argument
    v.describe();
}

int main() {
    Train t {6};
    t.describe();
    show(t);
}
```

```text
a train of 6 cars
a vehicle
```

`show` gets a copy, made by `Vehicle`'s generated copy constructor. That constructor knows only Vehicle's members, so the copy is a plain Vehicle: the Train part, `car_count` and all, is cut off. This is **slicing**, the trouble with copying in hierarchies that lesson 24 promised.

> ⚠️ **Slicing is silent.** Passing a derived object by value to a base-class parameter compiles without a word. The book expects a warning (C++ discourages generated copies in a class with a destructor), but Clang gives it only under `-Wdeprecated`, which the app doesn't use. Pass hierarchy objects by reference or pointer (lesson 21).

Better still, make the mistake impossible. A function holding a `Vehicle&` could be looking at a Train, a Bus or a class nobody has written yet, so it can't know what a full copy would contain. Writing **`= delete`** in place of a body forbids an operation: the compiler won't generate it, and any use is an error.

```cpp
class Vehicle {
public:
    Vehicle() = default;
    Vehicle(const Vehicle&) = delete;               // no copying
    Vehicle& operator=(const Vehicle&) = delete;
    virtual void describe() const { std::cout << "a vehicle\n"; }
    virtual ~Vehicle() = default;
};
```

Add those three lines to Vehicle in the editor and tap **Run**: `show(t)` now stops with `call to deleted constructor of 'Vehicle'`, and the notes point at the `= delete` line and at `show`'s parameter. Make it `const Vehicle&` and the Train prints as a Train.

- Why `Vehicle() = default;`? A deleted copy constructor still counts as a declared constructor, so the default one is no longer generated (lesson 26's table). `Train`'s constructor names no Vehicle constructor, so it needs that default one; without it you get lesson 22's `must explicitly initialize the base class 'Vehicle'` error.
- The book's `Shape` (p. 55) deletes the two move operations too. Deleting the copies is enough: that switches off the generated moves (lesson 26), so `std::move` finds only the deleted copy, and fails.
- To copy through a base, the usual answer is a virtual `clone()`; the book only mentions it.

`= delete` works on any function. A base class is one kind of object you shouldn't copy; the exercise has another.

## The rule of zero

Take Timings from lessons 24 and 25: a destructor and four copy and move operations, some 30 lines. Replace its `int* elem` and `int sz` with one member, `std::vector<int> minutes`, and every one of them can go. The generated operations work member by member (lesson 26), and the vector already knows how to copy (every element), move (hand over its array) and clean up (give its array back). Nothing left to get wrong: no self-assignment, no forgotten `sz`, no leak.

That's the **rule of zero**: let members that are handles own the resources, and declare none of the five. A class that manages a resource directly, like the book's Vector (lessons 19, 24, 25), follows the **rule of five**: lesson 24's rule of three plus the two moves, declared as lesson 26's matched set.

A member that can be moved but not copied, like a `unique_ptr`, makes its class **move-only** by itself: it can be moved, never copied.

```cpp
class Bay {                               // one parking bay in the depot
public:
    void park(std::unique_ptr<Vehicle> v) {
        parked = std::move(v);            // v has a name: std::move hands it on (lesson 25)
    }
private:
    std::unique_ptr<Vehicle> parked;      // owns whatever is parked there
};

// ... in a function, with lesson 23's Vehicle and Bus:
Bay a;
a.park(std::make_unique<Bus>(40));
Bay b {std::move(a)};    // fine: the bus changes bays
Bay c {b};               // error: call to implicitly-deleted copy constructor of 'Bay'
```

The note under the error says why: `field 'parked' has a deleted copy constructor`. Bay needs no destructor either; the `unique_ptr` deletes the vehicle.

The book's advice (p. 56) sums it up: avoid naked `new` and `delete` ([11]); a class with a destructor probably needs its copy and move operations written or deleted ([28]); and where the generated version is right, let the compiler write it ([31]).

## Exercise: Rule-of-zero refit

The starter's `Timings` is lesson 25's, with its destructor and all four copy and move operations written by hand (minus the tracing lines). `main` copies, assigns and moves Timings, then counts people through a gate. The starter runs, and only the gate line is wrong: tap **▶ Run** on it first.

1. Replace `elem` and `sz` with one member, `std::vector<int> minutes;`. Rewrite the constructor (`: minutes{list}`), both `operator[]`s, `size()` (with lesson 20's `static_cast<int>`) and `total()` to use it.
2. Erase the destructor and all four copy and move operations: don't mark them `= delete`, and don't leave an empty `~Timings() {}`, which would switch off the generated moves (lesson 26's Route). (Until you do, step 1 breaks the build: these still use `elem` and `sz`.) Tap **Run**: the Timings lines must match the starter's (the first six lines below).
3. A `Gate` is lesson 11's Turnstile with a name: one real turnstile, so a copy makes no sense. The starter prints `north gate: 0 passes`, because three people went through a copy. Add `Gate(const Gate&) = delete;` and `Gate& operator=(const Gate&) = delete;`, and tap **Run**. The error points at the call to `let_through`, and a note at the parameter that makes the copy. Fix the parameter so `let_through` counts on the real gate: a reference (lesson 7), but not `const`, since `pass()` changes the gate.

```expected
weekday: [3 2 4] 9 min
detour: [3 7 4] 14 min
express: [1 2 4] 7 min
a: [] 0 min
b: [] 0 min
c: [2 2 3] 7 min
north gate: 3 passes
```

`a` and `b` show the moves happened: this library empties a moved-from vector, but don't rely on it (lesson 25).

```cpp starter
#include <initializer_list>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

class Timings {
public:
    // TODO 1: rewrite with std::vector<int> minutes (see private:)
    Timings(std::initializer_list<int> list)
        : elem{new int[list.size()]}, sz{static_cast<int>(list.size())} {
        int i {0};
        for (int m : list) {
            elem[i] = m;
            ++i;
        }
    }

    // TODO 2: erase the destructor and the four copy and move operations
    Timings(const Timings& t) : elem{new int[t.sz]}, sz{t.sz} {
        for (int i = 0; i < sz; ++i) {
            elem[i] = t.elem[i];
        }
    }

    Timings& operator=(const Timings& t) {
        int* p {new int[t.sz]};
        for (int i = 0; i < t.sz; ++i) {
            p[i] = t.elem[i];
        }
        delete[] elem;
        elem = p;
        sz = t.sz;
        return *this;
    }

    Timings(Timings&& t) noexcept : elem{t.elem}, sz{t.sz} {
        t.elem = nullptr;
        t.sz = 0;
    }

    Timings& operator=(Timings&& t) noexcept {
        delete[] elem;
        elem = t.elem;
        sz = t.sz;
        t.elem = nullptr;
        t.sz = 0;
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
    // TODO 1: replace these two with std::vector<int> minutes;
    //         then rewrite the constructor, both operator[]s,
    //         size() and total() to use it
    int* elem;   // the minutes for each segment
    int sz;      // how many segments
};

class Gate {                          // one real turnstile
public:
    explicit Gate(const std::string& where) : place{where} { }
    // TODO 3: mark the copy constructor and copy assignment = delete
    void pass() { ++passes; }
    std::string name() const { return place; }
    int count() const { return passes; }
private:
    std::string place;
    int passes {0};
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
    std::cout << label << ": [";
    for (int i = 0; i < t.size(); ++i) {
        if (i > 0) {
            std::cout << ' ';
        }
        std::cout << t[i];
    }
    std::cout << "] " << t.total() << " min\n";
}

void let_through(Gate g, int people) {
    for (int i = 0; i < people; ++i) {
        g.pass();
    }
}

int main() {
    Timings weekday {3, 2, 4};
    Timings detour = weekday;          // copy
    detour[1] = 7;
    Timings express {2, 2};
    express = weekday;                 // copy assignment
    express[0] = 1;

    Timings a = express_run(true);     // moved out of the function
    Timings b {std::move(a)};          // move
    Timings c {5};
    c = std::move(b);                  // move assignment

    print("weekday", weekday);
    print("detour", detour);
    print("express", express);
    print("a", a);
    print("b", b);
    print("c", c);

    Gate north {"north"};
    let_through(north, 3);
    std::cout << north.name() << " gate: " << north.count() << " passes\n";
}
```

```cpp solution
#include <initializer_list>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

class Timings {
public:
    Timings(std::initializer_list<int> list) : minutes{list} { }

    int& operator[](int i) { return minutes[i]; }
    const int& operator[](int i) const { return minutes[i]; }
    int size() const { return static_cast<int>(minutes.size()); }
    int total() const {
        int sum {0};
        for (int m : minutes) {
            sum += m;
        }
        return sum;
    }

private:
    std::vector<int> minutes;   // owns the segments: nothing else to write
};

class Gate {                          // one real turnstile
public:
    explicit Gate(const std::string& where) : place{where} { }
    Gate(const Gate&) = delete;                 // one turnstile, one object
    Gate& operator=(const Gate&) = delete;
    void pass() { ++passes; }
    std::string name() const { return place; }
    int count() const { return passes; }
private:
    std::string place;
    int passes {0};
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
    std::cout << label << ": [";
    for (int i = 0; i < t.size(); ++i) {
        if (i > 0) {
            std::cout << ' ';
        }
        std::cout << t[i];
    }
    std::cout << "] " << t.total() << " min\n";
}

void let_through(Gate& g, int people) {    // the real gate, not a copy
    for (int i = 0; i < people; ++i) {
        g.pass();
    }
}

int main() {
    Timings weekday {3, 2, 4};
    Timings detour = weekday;          // copy
    detour[1] = 7;
    Timings express {2, 2};
    express = weekday;                 // copy assignment
    express[0] = 1;

    Timings a = express_run(true);     // moved out of the function
    Timings b {std::move(a)};          // move
    Timings c {5};
    c = std::move(b);                  // move assignment

    print("weekday", weekday);
    print("detour", detour);
    print("express", express);
    print("a", a);
    print("b", b);
    print("c", c);

    Gate north {"north"};
    let_through(north, 3);
    std::cout << north.name() << " gate: " << north.count() << " passes\n";
}
```

Once it passes, try two things, then undo them:

- Add `~Timings() {}` under the constructor and tap **Run**. `a` and `b` now print `[2 2 3] 7 min`: both moves copied (step 2's warning). (Check fails while the output differs.)
- Add `Gate spare {std::move(north)};` to `main`: `call to deleted constructor of 'Gate'`. With its copies deleted, a Gate can't be moved either.

That finishes chapter 4. Its advice list fills pp. 56–57, and p. 58 is blank. Chapter 5 (p. 59) is about **templates**: one `Vector` for any type of element, not just doubles.
