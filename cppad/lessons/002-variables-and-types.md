---
id: 2
title: Variables and types
concept: int, double, bool, char, std::string, auto, const
minutes: 10
---
# Variables and types

A variable is a named box with a **type**. The type decides what fits in the box and what you can do with it. C++ checks types at compile time, before the program ever runs.

```cpp
#include <iostream>
#include <string>

int main() {
    int stops = 12;               // whole numbers
    double minutes = 23.5;        // floating point
    bool express = false;         // true / false
    char line = 'B';              // one character
    std::string name = "Bloor";   // text (needs <string>)

    std::cout << name << " line " << line << ": " << stops << " stops, "
              << minutes << " min, express=" << express << '\n';
}
```

`bool` prints as `0`/`1` by default. `std::boolalpha` switches to `true`/`false`: `std::cout << std::boolalpha << express;`

## Initialise with braces

Modern C++ prefers `{}` initialisation because it refuses *narrowing* conversions that silently lose data:

```cpp
int a = 3.9;   // compiles; a is 3 (the .9 is thrown away)
int b{3.9};    // error: narrowing conversion from double to int
```

## `auto` and `const`

`auto` lets the compiler work out the type from the initialiser. `const` promises the value never changes; the compiler enforces it.

```cpp
auto count = 10;          // int
auto price = 3.25;        // double
auto label = std::string{"Union"};
const int seats = 60;
// seats = 61;            // error: cannot assign to a const variable
```

Use `const` by default for anything that doesn't need to change: it documents intent and catches bugs.

## Integer division gotcha

```cpp
std::cout << 7 / 2 << '\n';     // 3  (int / int -> int, truncated)
std::cout << 7 / 2.0 << '\n';   // 3.5
```

## Exercise

A trip has `stops = 9` and each stop takes `2.5` minutes. Print:

```expected
Stops: 9
Minutes per stop: 2.5
Total minutes: 22.5
Average of 7 and 8: 7.5
```

Store the numbers in `const` variables and compute the total. For the last line, watch out for integer division.

```cpp starter
#include <iostream>

int main() {
    const int stops = 9;
    // TODO: a const double for minutes per stop

    std::cout << "Stops: " << stops << '\n';
    // TODO: print the other three lines
}
```

```cpp solution
#include <iostream>

int main() {
    const int stops = 9;
    const double per_stop = 2.5;

    std::cout << "Stops: " << stops << '\n';
    std::cout << "Minutes per stop: " << per_stop << '\n';
    std::cout << "Total minutes: " << stops * per_stop << '\n';
    std::cout << "Average of 7 and 8: " << (7 + 8) / 2.0 << '\n';
}
```
