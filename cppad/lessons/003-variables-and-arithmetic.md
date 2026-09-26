---
id: 3
title: Variables and arithmetic
concept: variables, bits and bytes, expressions, fundamental types, sizeof, arithmetic, integer division, %, conversions, comparisons, &&, ||, !
minutes: 13
source: A Tour of C++
source_pages: 5-6
---
# Variables and arithmetic

Until now, every value went straight into a call, like `print_square(1.234)` in lesson 2. Real programs also need to *remember* values (a fare, a count, the minutes left) and change them as they go. For that, you give a value a name.

## Your first variable

```cpp
#include <iostream>

int main() {
    int stops = 5;    // type int, name stops, first value 5
    std::cout << "Stops left: " << stops << "\n";
    stops = 4;        // replace the value
    std::cout << "Stops left: " << stops << "\n";
}
```

It prints `Stops left: 5`, then `Stops left: 4`.

`int stops = 5;` is a **declaration**: it tells the compiler that from here on there's a name `stops`, and that it stands for an `int`. In lesson 2 you declared functions; this one declares a variable.

Behind that line is the computer's memory, a long row of **bytes**. A byte is 8 **bits**, and a bit is a single 0 or 1. The book names four ideas in the line:

- **Type**: `int`. It decides what can be stored (whole numbers) and what you may do with it (add, compare, print…).
- **Object**: the bytes of memory set aside for `stops`.
- **Value**: what those bytes hold right now, 5. The same bits read as a different type would mean something else.
- **Variable**: an object you reach through a name. `stops` is one, and so were the parameters in lesson 2: each held a copy of its argument.

The `= 5` **initializes** the variable, so it has a value from the moment it exists. The later `stops = 4;` is an **assignment**: it throws the old value away and stores a new one. Read `=` as "becomes". C++ works out the right side first, then stores the result on the left, so `stops = stops - 1;` takes one off.

An **expression** is any piece of code that works out a value: `5`, `stops`, `stops * 2`, `square(3)`. Every expression has a type too (`stops * 2` is an `int`), and the compiler checks each operation against the types involved. `stops * 2` is fine, but `stops * "two"` doesn't compile.

> 💡 Lesson 4 shows a second way to initialize, `int stops {5};`, and why it's usually the better choice. This lesson uses `=`, like the book does at this point.

## The fundamental types

A few types are built into the language: the **fundamental types**. The processor handles them directly, which makes them fast. Here are the five you'll use most (there are more, such as `long`):

| Type | Holds | Example values | Bytes in this app |
| --- | --- | --- | --- |
| `bool` | true or false | `true`, `false` | 1 |
| `char` | one character | `'a'`, `'Z'`, `'9'`, `'\n'` | 1 |
| `int` | a whole number | `-40`, `0`, `2026` | 4 |
| `double` | a number with a fractional part | `-3.5`, `0.25`, `2.0` | 8 |
| `unsigned` | a whole number, never negative | `0`, `7`, `4000` | 4 |

A `char` literal has **single quotes** and exactly one character. `'9'` is the character nine, not the number 9, and `"9"` in double quotes is a string (lesson 1). A `char` prints as its character:

```cpp
char line = 'Y';
std::cout << "Line " << line << '\n';   // Line Y
std::cout << '9' << ' ' << 9 << '\n';   // 9 9: same look, but the first is a character
```

- `'\n'` is one character too: the backslash and `n` together stand for a newline. `"\n"` still works, and both print a newline. From here on, lessons write `'\n'` when the newline stands alone and keep `\n` inside text that's already in quotes.
- `double` is short for *double-precision floating-point number*. *Floating point* means the decimal point can sit anywhere, so the same type holds 0.005 and 299792.458.
- More bytes allow bigger numbers. 4 bytes are 32 bits, enough for about 4.3 billion different values, so an `int` holds roughly -2.1 billion to +2.1 billion.

## How big is a type? `sizeof`

The `sizeof` operator tells you how many bytes a type takes:

```cpp
#include <iostream>

int main() {
    std::cout << "bool:   " << sizeof(bool) << '\n';
    std::cout << "int:    " << sizeof(int) << '\n';
    std::cout << "double: " << sizeof(double) << '\n';
    std::cout << "long:   " << sizeof(long) << '\n';
}
```

In this app that's 1, 4, 8 and 4. The sizes are **implementation-defined**: the compiler and the platform choose them. This app's compiler builds for WebAssembly, a 32-bit machine that runs inside the browser. Build the same code as a normal Mac or iPad app and `long` is 8 bytes (on Windows it's 4). Same code, different compiler or platform, different answer. Only `char` is pinned down: `sizeof(char)` is always 1, and a char is almost always one 8-bit byte.

> 💡 An `unsigned` can't go below zero. Subtract 1 from an `unsigned` that holds 0 and it wraps around to the largest `unsigned`, 4294967295 in this app. Mixing it with `int` is worse: in `-1 < 1u` (the `u` makes the 1 unsigned), the -1 is converted to 4294967295, so C++ decides -1 is *not* less than 1. Use plain `int` for everyday numbers, even ones that are never negative.

## Arithmetic

```cpp
#include <iostream>

int main() {
    int a = 17;
    int b = 5;
    std::cout << a + b << '\n';   // 22
    std::cout << a - b << '\n';   // 12
    std::cout << a * b << '\n';   // 85
    std::cout << a / b << '\n';   // 3, not 3.4
    std::cout << a % b << '\n';   // 2, the remainder
    std::cout << -a << '\n';      // -17
}
```

`-a` is **unary minus**. *Unary* means the operator works on a single value, its one **operand** (`a + b` has two operands). This one flips the sign. There's a unary `+a` too, which leaves a number's value as it is.

When both sides of `/` are integers, the result is an integer. The fraction is thrown away (**truncated**), not rounded: 5 goes into 17 three times, so `17 / 5` is 3. The **remainder** operator `%` gives what's left over, so `17 % 5` is 2. Together they split things up: 250 cents is `250 / 100` = 2 dollars and `250 % 100` = 50 cents. `%` only works on integers, so `7.5 % 2` doesn't compile.

> ⚠️ **Integer division.** `7 / 2` is 3, and `1 / 3` is 0. It compiles without a warning and quietly gives the wrong number. If you want the fraction, make at least one side a `double`: `7.0 / 2` is 3.5 (the next section explains why this works).

## Mixing `int` and `double`

An `int` and a `double` can share one calculation:

```cpp
#include <iostream>

int main() {
    double fare = 3.25;
    int riders = 4;
    std::cout << fare * riders << '\n';   // 13: riders' value is used as 4.0
}
```

`riders` itself stays the `int` 4. Before it calculates, C++ brings both sides to a common type, and for `int` with `double` that's `double`, so no fraction is lost. You can also store one type in the other, and C++ converts for you. The official name for these rules is the **usual arithmetic conversions**.

The other direction loses information. When a `double` from a variable or a calculation is stored in an `int`, the fraction is cut off, and the compiler doesn't even warn you:

```cpp
#include <iostream>

int main() {
    double d = 2.8;
    int i = 7;
    d = d + i;    // i's value is used as 7.0, so d is 9.8
    i = d * i;    // 9.8 * 7.0 is 68.6, cut down to the int 68
    std::cout << d << ' ' << i << '\n';   // 9.8 68
}
```

Again it's truncated, not rounded: 68.6 becomes 68, not 69. (That's as long as the whole-number part fits in an `int`; if it doesn't, the result is meaningless.) A literal, as in `int n = 7.2;`, at least gets a warning. Lesson 4 shows a way of *initializing* a variable that makes the compiler refuse this kind of loss.

## Comparisons

A comparison asks a yes-or-no question, and the answer is a `bool`:

```cpp
minutes == 10   // exactly 10?
minutes != 10   // anything but 10?
minutes < 10    // under 10?
minutes > 10    // over 10?
minutes <= 10   // 10 or less?
minutes >= 10   // 10 or more?
```

Mind the two equals signs in `==`. One `=` assigns ("becomes"); two compare ("equals?") and change nothing. Mix them up and it often still compiles: `std::cout << (minutes = 10);` prints 10 and quietly sets `minutes` to 10.

`std::cout` prints a `bool` as `1` for true and `0` for false:

```cpp
#include <iostream>

int main() {
    int minutes = 7;
    bool late = minutes > 5;
    std::cout << late << '\n';              // 1
    std::cout << (minutes == 10) << '\n';   // 0
    std::cout << (minutes <= 7) << '\n';    // 1
}
```

Put parentheses around a comparison when you print it. Without them, `std::cout << minutes == 10` means `(std::cout << minutes) == 10`. You get the warning `overloaded operator << has higher precedence than comparison operator`, then `error: invalid operands to binary expression`, then a long list of notes. Read the first lines and ignore the rest.

> 💡 `std::cout << std::boolalpha;` switches to printing `true` and `false`. The exercise below uses 1 and 0.

## And, or, not

The **logical operators** combine `bool`s:

- `a && b` (**and**) is true only when both are true.
- `a || b` (**or**) is true when at least one is true.
- `!a` (**not**) turns true into false and false into true.

```cpp
#include <iostream>

int main() {
    bool raining = true;
    int walk = 12;    // minutes to walk
    std::cout << (raining && walk > 10) << '\n';   // 1: take the bus
    std::cout << (!raining || walk < 5) << '\n';   // 0: neither is true
}
```

Comparisons are worked out before `&&` and `||`, so `walk > 10` needs no parentheses of its own. The outer pair is a must, and here forgetting it gives no error at all: `std::cout << raining && walk > 10 << '\n';` compiles without a word and prints just `1`, with no newline. `std::cout << raining` runs first, and everything after `&&` becomes a separate test whose answer is thrown away. So put parentheses around every comparison or `&&`/`||` test you print.

C++ also has **bitwise** operators (`&`, `|`, `^` and `~`) that work on the individual bits of an integer. You won't need them for a long time. For now, just don't mix up `&` with `&&` or `|` with `||`. Also, `^` does not mean "to the power of": `2 ^ 3` is 1, and Clang warns if you write that. For powers, `std::pow(2, 3)` from `<cmath>` gives 8.

## Exercise: Fix the trip calculator

The starter compiles and runs, but its output is wrong. Make it print exactly:

```expected
135 min = 2 h 15 min
2.4 km per stop
long trip: 1
express and crowded: 0
```

1. Line 1 is missing. Print all three numbers from `ride`, using `/` and `%` like the cents example (an hour has 60 minutes).
2. Line 2 prints `2`. Change one type so the division keeps its fraction.
3. `long trip` should be 1 when the ride takes more than 120 minutes. The starter asks the wrong question.
4. `express and crowded` should be 1 only when the train is an express *and* carries more than 100 riders.

Before you tap Run, predict what each line of the starter prints.

```cpp starter
#include <iostream>

int main() {
    int ride = 135;   // minutes
    // TODO 1: print "135 min = 2 h 15 min"

    int km = 12;
    int stops = 5;
    // TODO 2: this prints 2
    std::cout << km / stops << " km per stop\n";

    // TODO 3: wrong question
    std::cout << "long trip: " << (ride < 120) << '\n';

    bool express = true;
    int riders = 80;
    // TODO 4: wrong operator
    std::cout << "express and crowded: "
              << (express || riders > 100) << '\n';
}
```

```cpp solution
#include <iostream>

int main() {
    int ride = 135;   // minutes
    std::cout << ride << " min = " << ride / 60 << " h "
              << ride % 60 << " min\n";

    double km = 12.0;
    int stops = 5;
    std::cout << km / stops << " km per stop\n";

    std::cout << "long trip: " << (ride > 120) << '\n';

    bool express = true;
    int riders = 80;
    std::cout << "express and crowded: "
              << (express && riders > 100) << '\n';
}
```

Once it passes, change `ride` to 59 and `riders` to 150, and predict the new output before you run it.
