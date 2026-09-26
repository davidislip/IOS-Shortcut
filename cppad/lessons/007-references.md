---
id: 7
title: References
concept: references, auto& in range-for, reference parameters, const references, choosing how to pass arguments, declarator operators
minutes: 12
source: A Tour of C++
source_pages: 10-11
---
# References

So far, C++ has handed you copies. A range-for gives you a copy of each element (lesson 6), and a function parameter is a copy of its argument (lesson 2). Copies are safe: nothing you do to them can touch the original. But sometimes you *want* to change the original, like adding a delay to every time in a list. And sometimes a copy is pure waste: why copy a million elements just to add them up? **References** solve both problems.

## Changing elements in a range-for

The whole timetable slips by 2 minutes. Add one `&` to lesson 6's range-for:

```cpp
#include <iostream>

int main() {
    int departures[] {5, 12, 20, 31};

    for (auto& t : departures) {   // t refers to each element in turn
        t += 2;                    // so this changes the array itself
    }

    for (auto t : departures) {    // a copy is fine for printing
        std::cout << t << ' ';
    }
    std::cout << '\n';             // 7 14 22 33
}
```

Read `auto& t` as "`t` is a reference to each element". In each round, `t` *is* that element, under another name, so `t += 2` changes the array. Without the `&`, `t` would be a copy, and each `+= 2` would be thrown away at the end of its round. The book's `increment()` does the same thing with `++x`; it starts at the bottom of p. 10 and ends on p. 11.

## What is a reference?

A **reference** is another name for an object that already exists:

```cpp
#include <iostream>

int main() {
    int minutes {5};
    int& m {minutes};                 // m is another name for minutes

    m += 3;                           // changes minutes
    std::cout << minutes << '\n';     // 8
}
```

Here the `&` is part of the type: `int&` reads "reference to int". There's still only one `int` here, with two names. Whatever you do to `m` happens to `minutes`. (`int& m = minutes;` means the same.)

The range-for at the top works the same way: `auto` works out `int` from the array (lesson 4), so `auto& t` is an `int&`, a new name for one element.

Two rules follow from "another name for an existing object":

1. **A reference must be initialized.** It has to know what it refers to from the start. `int& r;` on its own is an error: `declaration of reference variable 'r' requires an initializer`.
2. **It never switches to another object.** Assigning to a reference later assigns to the object it refers to:

```cpp
int a {1};
int b {7};
int& r {a};   // r refers to a, for good
r = b;        // copies b's value into a: now a is 7, and r still refers to a
```

So how did `auto& t` reach every element of `departures`? Each round of the loop makes a brand-new `t` that refers to the next element. No reference ever moves.

Lesson 8 introduces *pointers*, another way to reach an object from somewhere else. With a pointer you write a `*` in front of its name each time you want the value, and it can later be aimed at a different object. A reference is the simpler tool: you use it exactly like the original name, and rule 2 always holds.

## Reference parameters

Put `&` on a parameter and the function works on the caller's own variable instead of a copy:

```cpp
#include <iostream>

void add_five_to_copy(int n) {    // n is a copy
    n += 5;
}

void add_five(int& n) {           // n is the caller's variable
    n += 5;
}

int main() {
    int eta {10};
    add_five_to_copy(eta);
    std::cout << eta << '\n';     // 10: only the copy changed
    add_five(eta);
    std::cout << eta << '\n';     // 15
}
```

Both calls look the same. Only the function's declaration tells you whether it may change your variable.

And rule 1? Each call creates a fresh `n` that refers to that call's argument, so the argument is its initializer.

Run it and Clang warns `parameter 'n' set but not used`. It noticed that `add_five_to_copy` changes its copy and never looks at it again, which is pointless.

A plain `&` parameter needs a variable it's allowed to change. `add_five(10)` fails with `no matching function for call to 'add_five'`, and the note under it says `expects an lvalue`. An *lvalue* is, roughly, an object with a place in memory you can name, like a variable or `v[0]`. A plain `10` is just a value, so there's nothing for `add_five` to change.

### A vector by reference

It works the same for a vector. The book's example is a `sort()` that takes a `vector<double>&`, so calling it sorts your vector itself, without copying it first. Here's a simpler one:

```cpp
#include <iostream>
#include <vector>

void record(std::vector<int>& history, int minutes) {
    history.push_back(minutes);   // adds to the caller's vector
}

int main() {
    std::vector<int> trips;       // starts empty (lesson 6)
    record(trips, 12);
    record(trips, 9);
    std::cout << trips.size() << " trips\n";   // 2 trips
}
```

> ⚠️ **A missing `&` changes a copy, and the program still runs.** Take the `&` out of `record` and each call adds to a copy that disappears when `record` ends. The program quietly prints `0 trips`, with no warning at all. Clang sometimes notices, as with `parameter 'n' set but not used` above, or `variable 'x' set but not used` for `for (auto x : v) { ++x; }`. Don't count on it: if a loop or a function seems to do nothing, look for a missing `&`.

## `const` references: no copy, no changes

Now a function that only *reads* a vector. Passing it by value would copy every element on every call: a million-element vector means copying a million numbers just to look at them. A plain `&` avoids the copy, but it tells every reader "this function may change your vector". Adding `const` (lesson 5) says both things you mean: no copy, and no changes.

The book shows only the declaration, `double sum(const vector<double>&)`, with no parameter name (lesson 2). Here's a full version:

```cpp
#include <iostream>
#include <vector>

double sum(const std::vector<double>& v) {   // no copy, read-only
    double s {0.0};
    for (auto x : v) {
        s += x;
    }
    return s;
}

int main() {
    const std::vector<double> fares {3.25, 3.25, 2.10};
    std::cout << sum(fares) << '\n';          // 8.6
}
```

The compiler holds `sum` to its promise. Add `v[0] = 0.0;` inside it and the build fails: `cannot assign to return value because function 'operator[]' returns a const value`. Behind the scenes, `v[0]` calls a function named `operator[]` (lesson 11 shows how to write one). The message just means that through a `const` reference, the elements are read-only.

A `const` reference is also less fussy about what you pass. It accepts `fares`, which a plain `std::vector<double>&` would refuse because `fares` is `const`. It even accepts a value that isn't a variable: `sum({1.5, 2.5})` works and prints 4, where `add_five(10)` failed. Nothing will be changed, so no variable is needed.

You'll see `const&` parameters in almost every C++ program: for vectors, for `std::string`, and for any type that's expensive to copy.

> 💡 The same choice applies in a range-for. For a `std::vector<std::string>`, `for (const auto& name : names)` reads each string without copying it.

## Which one should I use?

Here `T` stands for any type.

- **Small values you only read** (`int`, `double`, `char`, `bool`): by value, `int n`. A copy is as cheap as a reference.
- **Big objects you only read** (`std::string`, `std::vector`): `const T&`.
- **Anything the function must change for the caller:** `T&`.

A range-for's variable follows the same rule: `auto x` to read small elements, `const auto& x` to read big ones like strings, `auto& x` to change them.

## Declarator operators

Inside a declaration, `[ ]`, `*` and `&` don't compute anything: they build a type. Because they sit in the *declarator* (the part of a declaration around the name), they're called **declarator operators**. Here `T` and `A` stand for any types:

| Declaration | Type | Read it as | Lesson |
| --- | --- | --- | --- |
| `T a[n];` | `T[n]` | array of n Ts | 6 |
| `T* p;` | `T*` | pointer to T | 8 |
| `T& r;` | `T&` | reference to T | 7 (this one) |
| `T f(A);` | `T(A)` | function taking an A, returning a T | 2 |

(`T& r;` is only notation here: a real reference needs an initializer.) In an expression, the same symbols do other jobs: `v[i]` picks an element (lesson 6), `a * b` multiplies (lesson 3), and lesson 8 uses `&x` for "the address of `x`" and `*p` for "the object `p` points to".

## Exercise: Track work

Because of track work, the northbound and southbound trains swap platforms, and every segment of the trip gets a minute slower. Write three functions:

1. `void swap_values(int& a, int& b)` swaps the values of the caller's two variables. Hint: you'll need a third variable to hold one value while you overwrite it.
2. `void add_delay(std::vector<int>& times, int delay)` adds `delay` to every element. Use a range-for with `auto&`.
3. `int total(const std::vector<int>& times)` returns the sum of the elements.

`main` and a `print` helper are already written.

```expected
platforms: 1 and 2
after swap: 2 and 1
times: 3 2 4
with delay: 4 3 5
total: 12
```

The starter won't compile until all three functions exist. Each `use of undeclared identifier` error names one you still have to write.

```cpp starter
#include <iostream>
#include <vector>

// Prints the times on one line, separated by spaces.
void print(const std::vector<int>& times) {
    for (auto t : times) {
        std::cout << t << ' ';
    }
    std::cout << '\n';
}

// TODO: void swap_values(int& a, int& b)
//       afterwards, a has b's old value and b has a's old value

// TODO: void add_delay(std::vector<int>& times, int delay)
//       adds delay to every element of times

// TODO: int total(const std::vector<int>& times)
//       returns the sum of the elements

int main() {
    int northbound {1};
    int southbound {2};
    std::cout << "platforms: " << northbound << " and " << southbound << '\n';
    swap_values(northbound, southbound);
    std::cout << "after swap: " << northbound << " and " << southbound << '\n';

    std::vector<int> times {3, 2, 4};
    std::cout << "times: ";
    print(times);
    add_delay(times, 1);
    std::cout << "with delay: ";
    print(times);
    std::cout << "total: " << total(times) << '\n';
}
```

```cpp solution
#include <iostream>
#include <vector>

// Prints the times on one line, separated by spaces.
void print(const std::vector<int>& times) {
    for (auto t : times) {
        std::cout << t << ' ';
    }
    std::cout << '\n';
}

void swap_values(int& a, int& b) {
    const int old_a {a};   // keep a's value before overwriting it
    a = b;
    b = old_a;
}

void add_delay(std::vector<int>& times, int delay) {
    for (auto& t : times) {   // auto&: change the elements themselves
        t += delay;
    }
}

int total(const std::vector<int>& times) {
    int sum {0};
    for (auto t : times) {
        sum += t;
    }
    return sum;
}

int main() {
    int northbound {1};
    int southbound {2};
    std::cout << "platforms: " << northbound << " and " << southbound << '\n';
    swap_values(northbound, southbound);
    std::cout << "after swap: " << northbound << " and " << southbound << '\n';

    std::vector<int> times {3, 2, 4};
    std::cout << "times: ";
    print(times);
    add_delay(times, 1);
    std::cout << "with delay: ";
    print(times);
    std::cout << "total: " << total(times) << '\n';
}
```

Once it passes, delete the `&` from `add_delay`'s parameter (`std::vector<int> times`) and run it again. There's no warning, but the `with delay` line shows the old times and the total drops to 9: the delays went into a copy. Put the `&` back.

(The standard library already has a swap: `std::swap`, from `<utility>`. Writing your own once shows how it works.)
