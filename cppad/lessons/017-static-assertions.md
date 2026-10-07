---
id: 17
title: Static assertions
concept: assertions, static_assert, optional message, constant expressions only, compile-time tests, checking sizeof assumptions, choosing a check
minutes: 12
source: A Tour of C++
source_pages: 30-31
---
# Static assertions

Lesson 16's `assert` catches a bug while the program runs, but only if the program reaches that line with data that trips it. Types catch some mistakes sooner: pass a `std::string` where a function wants an `int`, and the build stops. Other facts are known before the program starts too: how many bytes an `int` has, or what a `constexpr` function returns for a constant argument (lesson 5). Checks on those can run while compiling, and a failure is a build error on your screen instead of a stopped program on someone else's. The book's rule of thumb: if a check can happen while compiling, that's usually the best time for it.

## `static_assert`

A statement of something you expect to be true is called an **assertion**. `assert` checks one while the program runs; **`static_assert`** checks one while compiling. Here is the book's example:

```cpp
#include <iostream>

static_assert(sizeof(int) >= 4, "integers are too small");   // checked while compiling

int main() {
    std::cout << "an int has " << sizeof(int) << " bytes\n";
}
```

`static_assert(condition, message)`: if the condition is true, the program builds as usual. If it's false, the build stops and the message becomes part of the error. Tap **Open in editor**, change the `4` to an `8` and tap **Run**:

```text
error: static assertion failed due to requirement 'sizeof(int) >= 8': integers are too small
note: expression evaluates to '4 >= 8'
```

The note is often the most useful line: it shows the values the compiler got.

Why check the size of an `int`? Lesson 3 said sizes depend on the compiler and the platform. For an `int`, the standard only promises 16 bits. On an Arduino Uno's small chip an `int` really is 2 bytes and tops out at 32,767, so code that counts a day's 86,400 seconds in an `int` goes wrong there. One line turns that silent breakage into a build error.

A few more facts:

- Since C++17 the message is optional. `static_assert(sizeof(long) == 8);` fails here (a `long` has 4 bytes, lesson 3) with just the condition and the note `expression evaluates to '4 == 8'`.
- It can stand outside any function (as above), inside a function body, or inside a class.
- It leaves no trace in the finished program: nothing runs, nothing gets slower.

## Only constants allowed

The condition must be a constant expression (lesson 5): something the compiler can work out on its own. So `static_assert` can't check a value that only exists while the program runs. The book shows this on pp. 30–31:

```cpp
constexpr double C = 299792.458;   // speed of light, km/s

void f(double speed)
{
    const double local_max = 160.0/(60*60);             // 160 km/h, in km/s
    static_assert(speed<C, "can't go that fast");       // error: speed must be a constant
    static_assert(local_max<C, "can't go that fast");   // the book says: OK
}
```

Clang rejects the first check with `static assertion expression is not an integral constant expression` and the note `function parameter 'speed' with unknown value cannot be used in a constant expression`. `f` can be called with any speed, so there's nothing to check while compiling. (*Integral* means whole-number, and to C++ a `bool` is a whole-number type.) That first line is the same whatever went wrong: the note says why.

> ⚠️ **The book's "OK" line fails too.** `local_max` is `const`, not `constexpr`, and lesson 5's exception for `const` only covers whole-number types: a `const double` doesn't count. Clang says `read of non-constexpr variable 'local_max' is not allowed in a constant expression`. Write what you mean, `constexpr double local_max {160.0 / (60 * 60)};`, and the check passes.

## The build is the test

A **test** is code that checks that other code gives the answers you expect. With a `constexpr` function, `static_assert` makes the compiler run it and check the answer. Here is lesson 5's `fare` with two tests:

```cpp
#include <iostream>

constexpr int base_fare {325};   // cents for 1 zone
constexpr int zone_extra {50};   // cents for each extra zone

constexpr int fare(int zones) {
    return base_fare + zone_extra * (zones - 1);
}

static_assert(fare(1) == 325);   // the compiler runs fare(1)
static_assert(fare(3) == 425);   // and checks the answer

int main() {
    std::cout << "3 zones: " << fare(3) << " cents\n";
}
```

Say someone tidies the formula into `base_fare + zone_extra * zones`. It looks right, but the build stops: `static assertion failed due to requirement 'fare(1) == 325'`, with the note `expression evaluates to '375 == 325'`. The `fare(3)` test fails too (`'475 == 425'`).

Most tests are separate programs someone must remember to run. These run on every build, so a broken `fare` never becomes a program. The limit: only `constexpr` functions called with constant arguments can be tested this way, so nothing that reads input or prints.

> 💡 Try `static_assert(fare(73000001) > 0);`. The answer is too big for an `int` (lesson 3), and going past its limit is undefined behaviour (lesson 2). The compiler won't guess a result: you get the first line from `speed`, and the note `value 3650000000 is outside the range of representable values of type 'int'`.

The book says its most important use comes with templates, code written once for many types (§5.4, chapter 5).

## Which check, when?

The book ends the section with "For runtime-checked assertions, use exceptions" (lesson 15). In this app, and in plenty of code built without exceptions, the tools from lessons 15 and 16 do those jobs:

| The problem | Found | Use | When it fails |
| --- | --- | --- | --- |
| a wrong assumption: a `sizeof`, a `constexpr` result | while compiling | `static_assert` | the build stops |
| a bug: the code breaks its own rules | while running | `assert` | the program stops |
| bad data from outside: input, a missing stop | while running | `std::optional`, `std::expected` | the caller decides |

The first column picks the row, as in lesson 16: it isn't a ranking. If a check could run at either time, the rule of thumb says compile time.

## Exercise: Trips past midnight

Times are minutes after midnight: 08:57 is 8 × 60 + 57 = 537. `trip_minutes(dep, arr)` says how long a trip takes. It has one test, which passes, yet the last train of the night comes out at -1420 minutes. Make the program print:

```expected
08:57 -> 09:15: 18 min
17:45 -> 18:27: 42 min
23:50 -> 00:10: 20 min
```

1. Below the first test, add `static_assert(trip_minutes(1430, 10) == 20, "trips can cross midnight");` and tap **Run**. The build fails, and the note shows what the function really returns: `expression evaluates to '-1420 == 20'`.
2. Add `constexpr int minutes_per_day {24 * 60};` above `trip_minutes`, then fix it: add a day's minutes to the difference, and take `% minutes_per_day` of that. Mind the parentheses: like `*`, `%` is worked out before `+` and `-`. Why not just `(arr - dep) % minutes_per_day`? In C++, `%` keeps the sign, so `-1420 % 1440` is still -1420. If you write that first, your new test catches it.
3. Add tests for two **edge cases**, the unusual inputs at the limits: 23:50 → 00:00 (1430 → 0) takes 10 minutes, and a trip with the same departure and arrival takes 0 minutes, not 1440. Then put the book's `int`-size check at the top. This program would fit in 2 bytes, but every lesson assumes 4: the check writes that down.

The starter compiles and runs as it is; step 1 stops it.

```cpp starter
#include <iostream>

// TODO 3: the book's check that an int has at least 4 bytes

// TODO 2: a constexpr minutes_per_day (24 * 60), then fix trip_minutes
constexpr int trip_minutes(int dep, int arr) {   // times in minutes after midnight
    return arr - dep;
}

static_assert(trip_minutes(537, 555) == 18);     // 08:57 -> 09:15
// TODO 1: 1430 -> 10 (23:50 -> 00:10) takes 20: "trips can cross midnight"
// TODO 3: 1430 -> 0 takes 10; a trip from 360 to 360 takes 0

// prints minutes after midnight as hh:mm, two digits each: 537 as 08:57
void print_time(int t) {
    int hours {t / 60};
    int minutes {t % 60};
    std::cout << hours / 10 << hours % 10 << ':' << minutes / 10 << minutes % 10;
}

void print_trip(int dep, int arr) {
    // Try: a parameter isn't a constant
    // static_assert(trip_minutes(dep, arr) >= 0);
    print_time(dep);
    std::cout << " -> ";
    print_time(arr);
    std::cout << ": " << trip_minutes(dep, arr) << " min\n";
}

int main() {
    print_trip(537, 555);
    print_trip(1065, 1107);
    print_trip(1430, 10);    // the last train
}
```

```cpp solution
#include <iostream>

static_assert(sizeof(int) >= 4, "integers are too small");

constexpr int minutes_per_day {24 * 60};

constexpr int trip_minutes(int dep, int arr) {   // times in minutes after midnight
    return (arr - dep + minutes_per_day) % minutes_per_day;
}

static_assert(trip_minutes(537, 555) == 18);     // 08:57 -> 09:15
static_assert(trip_minutes(1430, 10) == 20, "trips can cross midnight");
static_assert(trip_minutes(1430, 0) == 10);      // 23:50 -> 00:00
static_assert(trip_minutes(360, 360) == 0);      // 06:00 -> 06:00

// prints minutes after midnight as hh:mm, two digits each: 537 as 08:57
void print_time(int t) {
    int hours {t / 60};
    int minutes {t % 60};
    std::cout << hours / 10 << hours % 10 << ':' << minutes / 10 << minutes % 10;
}

void print_trip(int dep, int arr) {
    // Try: a parameter isn't a constant
    // static_assert(trip_minutes(dep, arr) >= 0);
    print_time(dep);
    std::cout << " -> ";
    print_time(arr);
    std::cout << ": " << trip_minutes(dep, arr) << " min\n";
}

int main() {
    print_trip(537, 555);
    print_trip(1065, 1107);
    print_trip(1430, 10);    // the last train
}
```

Once it passes, uncomment the **Try** line in `print_trip` and tap **Run**: `function parameter 'dep' with unknown value cannot be used in a constant expression`. Put the `//` back. Then delete `% minutes_per_day` from the fix. Both midnight tests still pass, but the first test fails (`expression evaluates to '1458 == 18'`), and so does the same-minute one. That's why old tests stay: they guard the cases a new fix can break. Put it back.

That completes the book's chapter 3. Chapter 4 (p. 33) turns back to classes.
