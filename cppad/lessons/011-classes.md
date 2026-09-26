---
id: 11
title: Classes
concept: class, public and private, interface, representation and implementation, member functions, invariants, constructors, member initializer list, operator[], handles, struct vs class
minutes: 15
source: A Tour of C++
source_pages: 17-18
---
# Classes

Lesson 10's `struct Vector` held a size and a pointer, and came with `vector_init()` to set them up. That works, but only if everyone who uses it follows the rules: call `vector_init()` first, and never change `sz` without changing `elem` to match. Nothing enforces those rules. `v.sz = 100;` compiles, and from then on the Vector lies about its size.

C++'s tool for this is the **class**: it bundles the data together with the functions that work on it, and locks everyone else out of the data. Then the rules only have to be right in one place.

## Interface and implementation

```cpp
#include <iostream>

class Turnstile {
public:
    void pass() { ++passes; }          // one more person goes through
    int count() { return passes; }     // how many so far?
private:
    int passes {0};
};

int main() {
    Turnstile north;
    Turnstile south;
    north.pass();
    north.pass();
    south.pass();
    std::cout << "north: " << north.count() << '\n';   // 2
    std::cout << "south: " << south.count() << '\n';   // 1
    // north.passes = -4;   // error: 'passes' is a private member of 'Turnstile'
}
```

- `class Turnstile { … };` defines a new type, the way `struct` did in lesson 10. Note the `;` after the closing `}`.
- The members after `public:` are the **interface**: what code outside the class may use. Here that's two functions.
- The members after `private:` are hidden: only the class's own member functions can use them. Uncomment the last line of `main` and Clang stops with `'passes' is a private member of 'Turnstile'`. The book calls this hidden data the **representation**. The representation, together with the bodies of the member functions, is the class's **implementation**.
- `pass()` and `count()` are **member functions**: functions declared inside the class. You call one on an object with a dot, `north.pass()`, just like `waits.size()` in lesson 6. (A class can also contain types as members; the book uses that later.)
- Inside a member function, `passes` means *this object's* `passes`. Each Turnstile has its own, so `north.pass()` leaves `south` alone.

Member functions can use members declared further down, like `passes` here: the compiler reads the whole class before it looks inside the function bodies.

> 💡 You'll also meet `int count() const { … }`. That `const` promises not to change the object, and you need it to call the function through a `const&` (lesson 7); without it, Clang says the function "is not marked const". The book explains it in chapter 4.

### Why hide the data?

- **It's simpler to use.** You only need to know `pass()` and `count()`, not how the counting works.
- **The data stays consistent.** `passes` starts at 0, and only `pass()` can change it, by adding 1, so it can never be negative. A rule that is always true of an object's data is called an **invariant**. Since the member functions are the only way in, you check them once, and the invariant holds for every Turnstile in the program.
- **The inside can change later.** Say you later want to count per hour as well. You change the inside of the class, and code that only calls `pass()` and `count()` keeps working, untouched.

## Constructors

A Turnstile can start at 0 by itself. But some objects make no sense until you tell them something: a train needs its line and its number of cars. A **constructor** is a member function with the same name as the class and no return type. It runs automatically every time an object is created. Here's lesson 10's `Train` again, as a class:

```cpp
#include <iostream>
#include <string>

class Train {
public:
    Train(const std::string& name, int cars) : line{name}, car_count{cars} { }
    void describe() {
        std::cout << line << " line, " << car_count << " cars\n";
    }
private:
    std::string line;
    int car_count;
};

int main() {
    Train a {"Yonge", 6};    // runs the constructor with "Yonge" and 6
    Train b {"Bloor", 4};
    a.describe();            // Yonge line, 6 cars
    b.describe();            // Bloor line, 4 cars
    // Train c;              // error: no matching constructor for initialization of 'Train'
}
```

(The member is now `car_count`, so it's easy to tell apart from the parameter `cars`.)

The constructor is **guaranteed** to run. With lesson 10's first `Train` (a plain `int cars;`), `Train t;` compiled and left `cars` uninitialized. Now there's no way to make a Train without a line and a number of cars, so `Train c;` doesn't compile, and there's no `vector_init()` to forget.

Uncomment `Train c;` and Clang adds `note: candidate constructor …` lines under the error. They list every constructor it tried, including a copy constructor and a move constructor that C++ writes for every class by itself (the book covers those in chapter 4). You can skip those notes.

The part between the `:` and the body, `: line{name}, car_count{cars}`, is the **member initializer list**. (Despite the name, it's the whole `:` part, not lesson 4's initializer list of braces, though each member's value is written in braces.) It gives each member its first value, in `{}`, before the body runs. Nothing is left for the body to do, so it's empty: `{ }`. Members are always initialized in the order the class declares them, so list them in that order (Clang warns if you don't).

Why not write `line = name;` in the body instead? Then `line` would first be made empty and then changed: two steps instead of one. The list gives each member its value as it's created. And a `const` member (lesson 5) can't be assigned at all, only initialized.

> ⚠️ **A member left out of the list.** A constructor only initializes the members it lists. A member you leave out gets its default member initializer (lesson 10) if it has one, like Turnstile's `passes {0}` above. Otherwise it's uninitialized, just like `int n;`, and Clang doesn't warn. So give every member a value: in the list, or with `{0}` in the class.

The book creates objects with parentheses, `Vector v(6);`. For `Train`, `Train a("Yonge", 6);` does the same job as `Train a {"Yonge", 6};`, with one difference: `()` lets narrowing through (lesson 4). With `double n {6.7};`, `Train a("Yonge", n);` quietly gets 6 cars, while `Train a {"Yonge", n};` stops with `type 'double' cannot be narrowed to 'int'`. That's why these lessons keep to `{}`.

> 💡 `std::vector` is an exception: `std::vector<int> v(6);` makes six elements, all 0, but `std::vector<int> v {6};` makes one element, 6. With braces, a vector treats the values as its list of elements.

## Defining `[ ]` for your own type

`std::vector` lets you write `v[i]`. Your class can do the same by defining a member function named `operator[]`:

```cpp
#include <iostream>

constexpr int train_cars {4};

class Cars {                     // riders in each car of a 4-car train
public:
    int& operator[](int i) { return riders[i]; }
    int size() { return train_cars; }
private:
    int riders[train_cars] {};   // all 0 to start (lesson 6)
};

int main() {
    Cars train;
    train[0] = 12;
    train[2] = 30;
    train[2] += 5;
    for (int i = 0; i < train.size(); ++i) {
        std::cout << "car " << i << ": " << train[i] << " riders\n";
    }
}
```

This prints `car 0: 12 riders`, `car 1: 0 riders`, `car 2: 35 riders` and `car 3: 0 riders`. (No warning from `i < train.size()` this time: our `size()` returns an `int`, not the unsigned type of `std::vector`'s `size()` from lesson 6.)

`train[2]` is short for `train.operator[](2)`. The function returns `int&`, a reference (lesson 7), so `train[2]` isn't a copy of the number: it *is* `riders[2]`, under another name. That's why `train[2] = 30;` changes the element inside the object. If `operator[]` returned a plain `int`, you'd get back a copy of the number, and `train[2] = 30;` would fail with `expression is not assignable`: there's nothing to store the 30 in.

Returning a reference is safe here because `riders` is part of the object: it exists as long as `train` does. Never return a reference to a function's own local variable: it's destroyed when the function returns (lesson 5).

## The book's Vector

Now you can read the class on p. 17. It's lesson 10's struct with the rules built in:

```cpp
class Vector {
public:
    Vector(int s) : elem{new double[s]}, sz{s} { }   // replaces vector_init()
    double& operator[](int i) { return elem[i]; }     // v[i]
    int size() { return sz; }
private:
    double* elem;   // points to the elements
    int sz;         // how many elements there are
};
```

`Vector v(6);` runs the constructor, which gets 6 doubles from the free store (lesson 10), then stores the pointer in `elem` and the 6 in `sz`. Users only see `Vector(int)`, `v[i]` and `v.size()`, so they can't skip the setup or change `sz` behind its back. The book's `read_and_sum()` on p. 18 now just writes `Vector v(s);` and uses `v[i]` and `v.size()`.

In memory, `v` looks just like lesson 10's picture: `elem` points to 6 doubles on the free store, and the object itself is only a pointer and an int, 8 bytes on this iPad.

The book's word for this is a **handle**: a small object that never changes size and tells you where the real data lives. When a program can't know in advance how much data it will hold, C++ reaches for a handle. `std::vector` is built this way: on this iPad, `sizeof` gives 12 for any `std::vector<int>`, empty or holding a thousand numbers.

Two things are still missing, and the book says so:

- **The memory is never given back**: lesson 10's memory leak. The book adds a *destructor* for that in §4.2.2. Until then, keep elements in a `std::vector`, which does all of this for you, properly.
- **No error handling.** Nothing stops `v[7]` on a 6-element Vector: like an out-of-range array index (lesson 6), it's undefined behaviour (lesson 2). The book adds checks in §3.4 using *exceptions*, which this app can't run. In these lessons, a member function reports a problem through its return value: a `bool` for now (as in the exercise), `std::optional` later.

## `struct` or `class`?

Until inheritance (chapter 4 of the book), there's only one difference. In a `struct`, members are public unless you say otherwise. In a `class`, they're private unless you say otherwise. A struct can have constructors and member functions too.

```cpp
struct Stop {            // public by default
    std::string name;
    int minutes {0};
};

class Card {             // private by default
    int cents {0};       // private: nothing says otherwise
public:
    int balance() { return cents; }
};
```

A common habit: a `struct` for a plain bundle of data that anyone may change (like lesson 10's `Trip`), a `class` when there's an invariant to protect.

> 💡 **Forgetting `public:`**. A class's members start out private, so without `public:` nothing outside the class can call its functions: `'balance' is a private member of 'Card'`. Even the constructor is locked away: `calling a private constructor of class 'Train'`. When you see these errors, check where your `public:` is.

## Exercise: Fare card

A fare card holds money, in cents, and pays for rides. Its invariant: the balance is never negative. `tap` refuses any fare the card can't cover, and nothing outside the class can touch `cents`. (A negative starting amount would still break it; the book deals with that kind of error in §3.4.) Complete `class Fare_card`:

1. A constructor `Fare_card(int amount)` that gives `cents` the value `amount` and `ride_count` the value 0, with a member initializer list. Give both members a value: leave `ride_count` out and `rides()` prints a wrong number, with no warning.
2. `bool tap(int fare)`: if the fare is more than the balance, return `false` and change nothing (the card is declined). Otherwise take the fare off the balance, count one ride, and return `true`.
3. `int balance()` and `int rides()`, which return the balance and the number of rides. They can't be called `cents()` and `ride_count()`: a class can't have a data member (a member variable, like `cents`) and a member function with the same name. Clang says `duplicate member 'cents'` (or `redefinition of 'cents' as different kind of symbol`, if the data member comes first).
4. In `main`'s loop, tap 325 cents each time. Print `tap: ok, balance <balance>` if it worked, otherwise `tap: declined, balance <balance>` (if/else, lesson 9).

```expected
tap: ok, balance 675
tap: ok, balance 350
tap: ok, balance 25
tap: declined, balance 25
rides: 3
```

The starter won't compile until the class has its constructor and member functions. That's normal: read the first error, fix it, repeat. The first error is `no matching constructor for initialization of 'Fare_card'`: that's TODO 1 (skip the candidate notes under it, as with `Train c;`). The warnings `private field 'cents' is not used` go away once your member functions use the fields.

```cpp starter
#include <iostream>

class Fare_card {
public:
    // TODO 1: the constructor Fare_card(int amount), with a member
    //         initializer list: cents gets amount, ride_count gets 0.

    // TODO 2: bool tap(int fare)
    //         - fare more than cents: return false and change nothing
    //         - otherwise: take fare off cents, add 1 to ride_count,
    //           and return true

    // TODO 3: int balance() returns cents; int rides() returns ride_count.

private:
    int cents;         // money left on the card
    int ride_count;    // rides paid for so far
};

int main() {
    Fare_card card {1000};           // $10.00
    for (int i = 0; i < 4; ++i) {
        // TODO 4: tap 325 cents. If it worked, print
        //         "tap: ok, balance <balance>", otherwise
        //         "tap: declined, balance <balance>".
    }
    std::cout << "rides: " << card.rides() << '\n';
}
```

```cpp solution
#include <iostream>

class Fare_card {
public:
    Fare_card(int amount) : cents{amount}, ride_count{0} { }

    bool tap(int fare) {
        if (fare > cents) {
            return false;            // declined: nothing changes
        }
        cents -= fare;
        ++ride_count;
        return true;
    }

    int balance() { return cents; }
    int rides() { return ride_count; }

private:
    int cents;         // money left on the card
    int ride_count;    // rides paid for so far
};

int main() {
    Fare_card card {1000};           // $10.00
    for (int i = 0; i < 4; ++i) {
        if (card.tap(325)) {
            std::cout << "tap: ok, balance " << card.balance() << '\n';
        } else {
            std::cout << "tap: declined, balance " << card.balance() << '\n';
        }
    }
    std::cout << "rides: " << card.rides() << '\n';
}
```

Once it passes, add `card.cents = 5000;` to `main`, read the error, then take the line out again. That error is the invariant being protected: the only way to change the balance is through `tap`.
