---
id: 3
title: Decisions and loops
concept: if/else, for, while, range-for, % operator
minutes: 10
---
# Decisions and loops

## `if` / `else`

```cpp
int minutes = 7;
if (minutes < 5) {
    std::cout << "Run!\n";
} else if (minutes < 10) {
    std::cout << "Walk briskly\n";
} else {
    std::cout << "Grab a coffee\n";
}
```

Comparison operators: `==  !=  <  <=  >  >=`. Combine with `&&` (and), `||` (or), `!` (not).

> ⚠️ `=` assigns, `==` compares. `if (x = 5)` compiles (with a warning) and is always true. The `-Wall` flag we compile with warns you about it.

## The classic `for` loop

```cpp
for (int i = 0; i < 3; ++i) {
    std::cout << "i = " << i << '\n';
}
```

Three parts: *start*; *keep going while*; *after each step*. `++i` adds one.

## `while`

```cpp
int n = 20;
while (n > 1) {
    n /= 2;              // same as n = n / 2
    std::cout << n << ' ';
}
```

## Range-based `for`

When you just want each element of a collection, use a range-for. No index to get wrong:

```cpp
for (char c : std::string{"TTC"}) {
    std::cout << c << '.';
}
// prints T.T.C.
```

## `%`: remainder

`a % b` is the remainder of `a / b`. `n % 2 == 0` tests for even numbers; `n % 3 == 0` for multiples of 3.

## Exercise: Subway FizzBuzz

For the numbers 1 to 15, print `Fizz` for multiples of 3, `Buzz` for multiples of 5, `FizzBuzz` for multiples of both, otherwise the number. One per line.

```expected
1
2
Fizz
4
Buzz
Fizz
7
8
Fizz
Buzz
11
Fizz
13
14
FizzBuzz
```

Hint: check the "both" case first. Why does the order matter?

```cpp starter
#include <iostream>

int main() {
    for (int i = 1; i <= 15; ++i) {
        // TODO
        std::cout << i << '\n';
    }
}
```

```cpp solution
#include <iostream>

int main() {
    for (int i = 1; i <= 15; ++i) {
        if (i % 15 == 0) {
            std::cout << "FizzBuzz\n";
        } else if (i % 3 == 0) {
            std::cout << "Fizz\n";
        } else if (i % 5 == 0) {
            std::cout << "Buzz\n";
        } else {
            std::cout << i << '\n';
        }
    }
}
```
