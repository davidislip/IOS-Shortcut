---
id: 2
title: Functions
concept: defining and calling functions, return and void, int and double, declarations, headers and <cmath>, overloading
minutes: 12
source: A Tour of C++
source_pages: 3-5
---
# Functions

In lesson 1 everything happened inside `main`. Real programs split their work into **functions**: named pieces of code that `main` calls, and that can call each other.

## A first example

This is the book's example from p. 3:

```cpp
#include <iostream>

double square(double x) {    // square a number
    return x * x;
}

void print_square(double x) {
    std::cout << "the square of " << x << " is " << square(x) << "\n";
}

int main() {
    print_square(1.234);    // the square of 1.234 is 1.52276
}
```

Take `square` apart:

- `double` is the **return type**: the kind of value the function hands back.
- `square` is the function's **name**.
- `(double x)` is the **parameter list**. `x` is a **parameter**: a name for the value the function receives each time it runs.
- `{ … }` is the **body**: the statements that run each time the function is called.
- `return x * x;` hands the result back and ends the function. (`*` multiplies; lesson 3 covers all the operators.)

`print_square` has the return type `void`, meaning "hands nothing back". It does its printing and ends when it reaches its `}`.

`print_square(1.234)` is a **call**, and `1.234` is its **argument**, the value passed in. `main` calls `print_square`, and `print_square` calls `square`. The call `square(x)` sits in the middle of a `<<` chain: wherever you could write a value, you can write a call that returns one.

> 💡 The book writes `cout` without `std::` because its version starts with `using namespace std;` (lesson 1).

## Calls inside calls

Open this in the editor and run it:

```cpp
#include <iostream>

double square(double x) {
    return x * x;
}

int main() {
    std::cout << square(2.5) << "\n";             // 6.25
    std::cout << square(2) + square(3) << "\n";   // 4 + 9 = 13
    std::cout << square(square(2)) << "\n";       // square(4) = 16
}
```

In the last line, the inner call runs first, and its result becomes the argument of the outer call.

## Why many small functions?

A well-named function says what a piece of code does, so `print_square(1.234)` reads more clearly than the `std::cout` line it stands for. Its parameter list shows exactly what it needs. And bugs grow with the amount and tangle of code in one place. Short functions that each do one job are easier to read, to get right, and to reuse. Your `main` becomes a summary of the program.

## `int` and `double`: a first look

- `int` holds whole numbers: `2`, `42`, `-7`.
- `double` holds numbers that can have a fractional part: `1.234`, `2.5`, `-0.1`.

Lesson 3 has the full story. One thing to know now: `1.234 * 1.234` is really `1.522756`, but `std::cout` shows a `double` with at most 6 significant digits (digits counted from the first one that isn't zero), so it printed `1.52276`. A `double` with nothing after the point, like `6.0`, prints as `6`.

## Arguments are copies

When a function is called, each parameter starts out as a **copy** of its argument. If the types differ, the compiler converts the argument to the parameter's type, if it knows how:

```cpp
square(3);   // 3 is an int; x receives the double 3.0; the result is 9
```

Some conversions lose information. Pass `2.5` to an `int` parameter and it receives `2`: the fraction is dropped, and the compiler only warns (`implicit conversion from 'double' to 'int' changes value from 2.5 to 2`). Lesson 3 says more about conversions.

When no conversion exists, the build fails before the program ever runs:

```cpp
square("three");   // error: no matching function for call to 'square'
```

The note under that error says why: `no known conversion from 'const char[6]' to 'double'`. `const char[6]` is the compiler's name for the text `"three"`: 5 letters plus an end marker (lesson 8 explains it). To see it yourself, add `std::cout << square("three");` to the first example's `main` and run. This checking is one of C++'s strengths: the compiler catches the mistake, not your user.

Because `x` is a copy, even if `square` gave `x` a new value, the code that called `square` would never see the change. Lesson 7 shows how a function can work on the caller's own variable.

## Declare before you call

The compiler reads your file from top to bottom, and it only lets you call a function it has already seen. So far every function sat above the code that calls it. Many programmers prefer `main` at the top, so the summary of the program comes first. To do that, add a **declaration** above `main`:

```cpp
#include <iostream>

double cube(double x);    // declaration

int main() {
    std::cout << cube(2) << "\n";   // 8
}

double cube(double x) {   // definition
    return x * x * x;
}
```

- A **declaration** is the function's first line, ending in `;`. It tells the compiler everything it needs to check a call: the name, the return type, and the number and types of the parameters.
- A **definition** adds the body: what the function actually does. Every definition is also a declaration.

In a declaration that isn't a definition, parameter names are optional: `double cube(double);` works too. The compiler ignores the name there, but a good one tells the reader what to pass.

> ⚠️ Delete the declaration line and the build fails with `error: use of undeclared identifier 'cube'` (an identifier is a name, lesson 1). The function exists, just too late in the file. Declare it above the call, or move the whole definition up.

The opposite slip, a declaration with no definition anywhere, gets past the compiler, because a declaration is only a promise. The *linker* from lesson 1 notices the missing body instead: `wasm-ld: error: … undefined symbol: cube(double)` (`wasm-ld` is this app's linker).

## Library functions come from headers

A **header** is a file of declarations that you bring in with `#include`. `#include <iostream>` gave the compiler the declarations for `std::cout` and `<<`. The header `<cmath>` declares math functions, among them `std::sqrt`, the square root, with a declaration much like the one the book shows on p. 3: `double sqrt(double);`.

```cpp
#include <cmath>
#include <iostream>

int main() {
    std::cout << std::sqrt(16.0) << "\n";   // 4
    std::cout << std::sqrt(2.0) << "\n";    // 1.41421
}
```

> 💡 Include the header for everything you use. On this iPad `<iostream>` happens to pull in `<cmath>` behind the scenes, but another compiler or library may not, and then the build fails with `no member named 'sqrt' in namespace 'std'`.

The book's line `double s2 = sqrt(2);` makes the same point as `square(3)` above (the `int` 2 arrives as a `double`), and keeps the result in a *variable* named `s2`. Variables arrive in lesson 3.

The same type checking applies: `std::sqrt("three")` fails with `no matching function for call to 'sqrt'`, followed by a note for each version of `sqrt` the compiler tried. Several versions of one function? That's overloading, coming up next.

## Overloading: one name, several versions

Two functions may share a name if their parameter types differ. For each call, the compiler looks at the arguments and picks the version that fits best:

```cpp
#include <iostream>

void print(int n) {
    std::cout << "int: " << n << "\n";
}

void print(double d) {
    std::cout << "double: " << d << "\n";
}

int main() {
    print(501);    // int: 501
    print(3.75);   // double: 3.75
    print(2.0);    // double: 2
}
```

`2.0` prints as `2`, but it's still a `double`: the argument's *type* picks the version. This is **function overloading**, and it's why `<cmath>` can offer several versions of `std::sqrt` for different kinds of number. Versions that share a name should do the same job: here, each one shows the value it's given, labelled with its type. (The book also has a `print(string)` for text; text variables arrive in lesson 4.) The book calls overloading an essential part of generic programming (chapter 5).

Differing only in the return type isn't enough: `int half(int);` next to `double half(int);` fails with `functions that differ only in their return type cannot be overloaded`. The compiler picks a version from the arguments alone.

When two versions fit equally well, the compiler refuses to guess:

```cpp
void show(int platform, double minutes);
void show(double minutes, int platform);

void user() {
    show(1, 4);   // error: call to 'show' is ambiguous
}
```

Both `1` and `4` are `int`s. Each version needs one of them converted to `double`, so neither is a better match. Writing `show(1, 4.0)` makes the first version an exact match, and the error goes away. The book's `print(0,0)` on p. 5 fails for the same reason.

## Exercise: Platform announcements

Write three functions:

1. `void announce(int platform)`: `announce(2)` prints `Next train on platform 2`.
2. `void announce(double minutes)`, an overload: `announce(2.5)` prints `Next train in 2.5 minutes`.
3. `double trip_minutes(double stops)` returns `stops * 1.5` (each stop takes a minute and a half). **Declare** it above `main` and **define** it below `main`.

`main` is already written. Its last line passes the `int` 4 to `trip_minutes`, which receives `4.0`. The result, `6.0`, prints as `6`.

```expected
Next train on platform 2
Next train in 2.5 minutes
4 stops take 6 minutes
```

The starter won't compile until the functions exist. That's expected: each `use of undeclared identifier` error names something you still have to write.

If `announce(2.5)` prints `Next train on platform 2`, your `double` version is missing: with only the `int` one, `2.5` is converted to `2`, and the build only warns.

```cpp starter
#include <iostream>

// TODO: void announce(int platform)
//       prints "Next train on platform <platform>"

// TODO: void announce(double minutes), an overload
//       prints "Next train in <minutes> minutes"

// TODO: declare double trip_minutes(double stops) here...

int main() {
    announce(2);
    announce(2.5);
    std::cout << "4 stops take " << trip_minutes(4) << " minutes\n";
}

// TODO: ...and define it here: it returns stops * 1.5
```

```cpp solution
#include <iostream>

void announce(int platform) {
    std::cout << "Next train on platform " << platform << "\n";
}

void announce(double minutes) {
    std::cout << "Next train in " << minutes << " minutes\n";
}

double trip_minutes(double stops);   // declared here, defined below main

int main() {
    announce(2);     // 2 is an int: calls announce(int)
    announce(2.5);   // 2.5 is a double: calls announce(double)
    std::cout << "4 stops take " << trip_minutes(4) << " minutes\n";   // 4 becomes 4.0
}

double trip_minutes(double stops) {
    return stops * 1.5;
}
```

Once it passes, try two slips, putting each line back afterwards:

- Delete your `trip_minutes` declaration and read the error.
- Delete the `return` line in `trip_minutes`. The build only *warns*: `non-void function does not return a value` (and that `stops` is now unused). Run it anyway, and it stops with 💥 Program aborted. Running off the end of a function that promises a value is **undefined behaviour**: C++ promises nothing about what happens next. This app stops the run; elsewhere a program may carry on with a garbage value. So treat that warning as an error. Of the functions that return a value, only `main` may leave its `return` out (lesson 1).
