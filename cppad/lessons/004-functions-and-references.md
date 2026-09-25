---
id: 4
title: Functions and references
concept: functions, pass by value, pass by reference, const&
minutes: 12
---
# Functions and references

A function packages up some work under a name:

```cpp
#include <iostream>

int square(int x) {        // return type, name, parameters
    return x * x;
}

void greet(std::string_view who) {   // void = returns nothing
    std::cout << "Hi, " << who << "!\n";
}

int main() {
    std::cout << square(7) << '\n';   // 49
    greet("commuter");
}
```

A function must be *declared* before it's used, so helpers usually sit above `main`.

## Pass by value: you get a copy

```cpp
void add_one(int n) { n = n + 1; }   // changes the copy only

int x = 5;
add_one(x);
// x is still 5
```

## Pass by reference: you get the original

Add `&` to the parameter type and the function works on the caller's variable itself:

```cpp
void add_one(int& n) { n = n + 1; }

int x = 5;
add_one(x);
// x is now 6
```

## `const&`: no copy, no changes

Copying a big object (a long string, a vector with a million items) is expensive. `const T&` passes a reference, so no copy is made, and promises not to modify it:

```cpp
std::size_t count_spaces(const std::string& text) {
    std::size_t n = 0;
    for (char c : text) {
        if (c == ' ') ++n;
    }
    return n;
}
```

Rule of thumb:

| You want to…                          | Parameter type   |
|---------------------------------------|------------------|
| read a small value (int, double, char)| `T`              |
| read a big object                     | `const T&`       |
| modify the caller's variable          | `T&`             |

## Exercise

1. Write `int max_of(int a, int b)` that returns the larger number.
2. Write `void swap_ints(int& a, int& b)` that swaps two variables.
3. Write `int count_char(const std::string& s, char c)` that counts how often `c` appears in `s`.

```expected
max_of(3, 9) = 9
before: a=1 b=2
after:  a=2 b=1
'o' appears 9 times
```

```cpp starter
#include <iostream>
#include <string>

// TODO: max_of

// TODO: swap_ints

// TODO: count_char

int main() {
    std::cout << "max_of(3, 9) = " << max_of(3, 9) << '\n';

    int a = 1, b = 2;
    std::cout << "before: a=" << a << " b=" << b << '\n';
    swap_ints(a, b);
    std::cout << "after:  a=" << a << " b=" << b << '\n';

    const std::string station = "Bloor-Yonge to Spadina, going north on the loop";
    std::cout << "'o' appears " << count_char(station, 'o') << " times\n";
}
```

The starter won't compile until the functions exist. That's normal: read the first error, fix it, repeat.

```cpp solution
#include <iostream>
#include <string>

int max_of(int a, int b) {
    return a > b ? a : b;
}

void swap_ints(int& a, int& b) {
    const int tmp = a;
    a = b;
    b = tmp;
}

int count_char(const std::string& s, char c) {
    int n = 0;
    for (char ch : s) {
        if (ch == c) ++n;
    }
    return n;
}

int main() {
    std::cout << "max_of(3, 9) = " << max_of(3, 9) << '\n';

    int a = 1, b = 2;
    std::cout << "before: a=" << a << " b=" << b << '\n';
    swap_ints(a, b);
    std::cout << "after:  a=" << a << " b=" << b << '\n';

    const std::string station = "Bloor-Yonge to Spadina, going north on the loop";
    std::cout << "'o' appears " << count_char(station, 'o') << " times\n";
}
```

(In real code you'd use `std::max`, `std::swap` and `std::ranges::count`, but writing them once teaches you what they do.)
