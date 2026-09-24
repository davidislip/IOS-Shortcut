---
id: 6
title: Reading input
concept: std::cin, std::getline, input loops
minutes: 10
---
# Reading input

Programs get interesting when they react to input. `std::cin` reads from standard input, which here is the terminal: when your program waits for input, the prompt turns yellow and you type a line and press return.

```cpp
#include <iostream>
#include <string>

int main() {
    std::string name;
    int age = 0;

    std::cout << "Name? ";
    std::cin >> name;          // reads one whitespace-separated word
    std::cout << "Age? ";
    std::cin >> age;

    std::cout << "Hi " << name << ", next year you'll be " << age + 1 << '\n';
}
```

## Whole lines: `std::getline`

`>>` stops at spaces. To read a full line use `std::getline`:

```cpp
std::string line;
std::getline(std::cin, line);
```

> ⚠️ Mixing `>>` then `getline` is a classic trap: `>>` leaves the newline in the buffer, so the next `getline` reads an empty line. Call `std::cin >> std::ws;` before `getline` to skip leftover whitespace.

## Reading until the input ends

`std::cin >> x` evaluates to "true" while reading succeeds. That makes a neat loop:

```cpp
int x;
int sum = 0;
while (std::cin >> x) {
    sum += x;
}
```

The loop stops at end of input (tap **EOF** in the terminal, or press ctrl-D on a keyboard) or when the input isn't a number.

## Exercise

Read numbers until end of input, then print how many there were, their sum and the largest one. If there were no numbers, print `no numbers`.

**▶ Run** lets you type the numbers yourself; tap **EOF** when you're done. **Check ✓** feeds in this sample input and compares the output:

```stdin
4 8 15
16 23
42
```

```expected
count: 6
sum: 108
max: 42
```

```cpp starter
#include <iostream>

int main() {
    int x = 0;
    int count = 0;
    int sum = 0;
    int max = 0;

    while (std::cin >> x) {
        // TODO
    }

    // TODO: print results (or "no numbers")
}
```

```cpp solution
#include <iostream>

int main() {
    int x = 0;
    int count = 0;
    int sum = 0;
    int max = 0;

    while (std::cin >> x) {
        if (count == 0 || x > max) max = x;
        ++count;
        sum += x;
    }

    if (count == 0) {
        std::cout << "no numbers\n";
        return 0;
    }
    std::cout << "count: " << count << '\n';
    std::cout << "sum: " << sum << '\n';
    std::cout << "max: " << max << '\n';
}
```

Notice `if (count == 0 || x > max)`: starting `max` at `0` would be wrong if every number were negative.
