---
id: 4
title: Initialization, auto and strings
concept: {}-initialization, narrowing conversions, uninitialized variables, std::string, auto, compound assignment, ++ and --
minutes: 13
source: A Tour of C++
source_pages: 6-7
---
# Initialization, auto and strings

In lesson 3, every variable got its first value with `=`. This lesson finishes the book's section 1.5. It covers a second way to initialize, with curly braces, that catches mistakes `=` lets through. You'll also meet `auto`, which lets the compiler work out a variable's type, and the shortcuts `+=` and `++`. Along the way, you'll store text in a variable, with `std::string`.

## Initializing with braces

Instead of writing `=` and a value, put the value in curly braces. The braces and what's inside them are called an **initializer list**. You'll see that name in error messages.

```cpp
#include <iostream>

int main() {
    double fare {3.25};    // same as: double fare = 3.25;
    int riders {4};
    int platform = {2};    // = before braces: allowed, adds nothing
    std::cout << fare * riders << " on platform " << platform << '\n';
}
```

It prints `13 on platform 2`. For values like these, both forms do the same job. The `=` form is the traditional one: C++ inherited it from C, the older language it grew out of. The book calls the brace form the *universal* form, because braces work for every kind of variable. They can even hold a whole list of values, which you'll use for lists of numbers (`std::vector`, lesson 6).

So why bother with braces for a single number? Because they're stricter.

## Braces refuse to lose information

In lesson 3, `i = d * i` quietly cut 68.6 down to 68. A conversion that can lose information like that is called a **narrowing conversion**. The two you'll meet most:

- `double` to `int`: the fraction is dropped.
- `int` to `char`: a `char` is a single byte, so most `int` values don't fit in one.

With `=`, C++ allows narrowing, because C always did and C++ keeps old C code working. With braces, narrowing is a compile error:

```cpp
int fare = 3.25;        // compiles, with a warning: fare is 3 (surprise!)
int toll {3.25};        // error
int price = {3.25};     // error too: = plus braces is still braces
```

For `toll`, the terminal says:

```
error: type 'double' cannot be narrowed to 'int' in initializer list
```

The `fare` line at least gets a warning, `implicit conversion from 'double' to 'int' changes value from 3.25 to 3`, because the compiler can see the literal's fraction would be lost. When the value comes from a variable, `=` doesn't even warn you, but braces still refuse:

```cpp
double km {2.4};
int a = km;      // compiles with no warning: a is 2
int b {km};      // error: the same narrowing error
```

An error like this means you were about to lose part of a value. The fix is usually the right type, e.g. make `b` a `double`. (The note under the error suggests `static_cast<int>(…)`. That's an *explicit* conversion, for when you really do want to drop the fraction. The book covers it later.)

The compiler judges a literal by its value: `double d {2};` and `char c {65};` are fine, because it can see the value survives. A variable it judges by its type alone, and that catches one case lesson 3 called safe. With an `int` variable `stops`, `double d {stops};` is an error too (`non-constant-expression cannot be narrowed`). The rules count every whole-number-to-floating-point conversion as narrowing, because some whole-number types hold values too big for a `double` to store exactly.

Braces only check a variable's *first* value. A later assignment like `i = d * i;`, or `minutes += 4.5;` on an `int`, still drops the fraction without a word. So the braces help, but choosing the right type matters just as much.

Rule of thumb: **when you write the type, initialize with `{}`.**

## Give every variable a value

What if you give no initializer at all?

```cpp
int count;                     // declared, but no value
std::cout << count << '\n';    // what does this print?
```

The compiler warns `variable 'count' is uninitialized when used here`, and for good reason. An `int` declared inside a function with no initializer holds whatever bits were left in that memory. Reading it is a bug: undefined behaviour (lesson 2). The program might print any number, or misbehave in stranger ways.

The book's advice, in short: **don't create a variable before you know what it should hold.** So declare a variable where you first know its value. If a count really starts at zero, say so: `int count {0};`. Empty braces mean zero too: `int count {};`.

(Two things in lesson 5 behave differently: global variables start at 0, though you should still write the 0, and constants can't be left without a value at all: the compiler insists.)

Not every type leaves its variables full of junk, though. Types written in ordinary C++, rather than built into the language, are called **user-defined types**, even when the "user" who wrote them is the standard library. Such a type can make sure its variables always start in a sensible state. Here's the first one you'll use.

## Text: `std::string`

The fundamental types from lesson 3 each hold a single value: a number, a character, or true/false. For text, the standard library has `std::string`, from the header `<string>`:

```cpp
#include <iostream>
#include <string>

int main() {
    std::string line {"Line 1"};
    std::string note;                          // no initializer: empty text
    std::string board {line + " to Finch"};    // + joins text
    board += "!";                              // += adds to the end
    std::cout << board << '\n';
    std::cout << "[" << note << "]\n";         // the brackets show the empty text
}
```

```
Line 1 to Finch!
[]
```

- `std::string note;` is guaranteed to be empty, `""`, never junk. Compare that with `int count;` above.
- `+` **concatenates**: it joins two pieces of text into a new string. At least one side must be a `std::string`. The other side can be a literal like `" to Finch"`.
- `+=` adds text to the end of an existing string, in place.
- `+` and `+=` join text to text, never numbers. To show a number next to text, keep chaining `<<` as in lesson 1: `std::cout << "Stops: " << stops;`. Writing `"Stops: " + stops` instead compiles, with the warning `adding 'int' to a string does not append to the string`. With `stops` at 2, it prints `ops:` (lesson 8 explains why). `route += stops;` is worse: it compiles without a word and adds an invisible character.

## `auto`: let the compiler work out the type

The compiler always knows the type of the value you initialize with. Write `auto` instead of a type, and the variable gets that type. The type is **deduced**, meaning worked out, from the initializer:

```cpp
auto fare = 3.25;                // double
auto riders = 4;                 // int
auto total = fare * riders;      // double: double * int (lesson 3)
auto car = 'B';                  // char
auto late = total > 10;          // bool: a comparison
auto side = std::sqrt(2.0);      // double: what std::sqrt returns
```

`auto` doesn't mean "any type". `riders` is an `int` from then on, exactly as if you'd typed `int`. It's just that the compiler filled in the word for you.

Pair `auto` with `=`. The variable simply takes the initializer's type (quoted text is the one surprise, see below), so there's no conversion for braces to guard against. So the style in the book, and in these lessons, is **`{}` when you write the type, `=` with `auto`.** (Don't mix the two: `auto n = {0};` does not make an `int`.)

When should you write the type anyway? The book gives two reasons:

- **Readers should see it.** If a variable is used across a long stretch of code, `double balance {0.0};` tells the reader what it is without making them hunt for its first value.
- **You need a particular type or precision.** `auto minutes = 0;` makes an `int`, because `0` is an `int` literal. Add 4.5 to it later and you silently get 4. If you mean a `double`, write `double minutes {0.0};`.

Otherwise, let `auto` fill in the type: the initializer already shows it, so spelling it out again adds nothing. It really pays off later in the book, where some type names get long and hard to spell out.

> ⚠️ **Quoted text is not a `std::string`.** With `auto stop = "Union";`, `stop` gets C's older, simpler kind of text, a *C-style string* (the error calls it `const char *`; lesson 8 explains). You can't add text to it: `stop += " > King";` fails with `invalid operands to binary expression`. Write the type instead: `std::string stop {"Union"};`. For the same reason, `"Union" + " > King"` doesn't compile: neither side is a `std::string`.

## Shortcuts: `+=`, `++` and friends

Changing a variable based on its old value is so common that C++ has shorthand for it. Each line here changes `riders` using its old value:

```cpp
#include <iostream>

int main() {
    int riders {40};
    riders += 12;    // 52: twelve get on
    riders -= 5;     // 47: five get off
    riders /= 2;     // 23, not 23.5: half get off at Bloor-Yonge
    riders *= 3;     // 69: rush hour
    ++riders;        // 70: one more squeezes in
    --riders;        // 69: ...and changes their mind
    std::cout << riders << " riders\n";

    int seconds {200};
    int minutes {seconds / 60};    // 3 whole minutes
    seconds %= 60;                 // 20 seconds left over
    std::cout << minutes << " min " << seconds << " s\n";
}
```

```
69 riders
3 min 20 s
```

In full:

| Shorthand | Means |
|---|---|
| `x += y` | `x = x + y` |
| `x -= y` | `x = x - y` |
| `x *= y` | `x = x * y` |
| `x /= y` | `x = x / y` |
| `x %= y` | `x = x % y` |
| `++x` | `x = x + 1` (**increment**) |
| `--x` | `x = x - 1` (**decrement**) |

The rules from lesson 3 still apply: `riders` is an `int`, so `riders /= 2` is integer division. On a `std::string`, `+=` means "add to the end", as you saw above.

> 💡 You'll often see `x++` in other people's code. On a line of its own, it does the same as `++x`. The two only differ when the value is used inside a bigger expression. These lessons write `++x`, like the book.

## Exercise: Trip log

Log a two-segment ride and print a summary:

```expected
Route: Union > St George > Spadina
Stops: 2
Minutes: 7.5
Average: 3.75
```

- Use `{}` for every variable whose type you write: `std::string route {"Union"}`, `int stops {0}` and `double minutes {0.0}`.
- Segment 1 takes 4.5 minutes and ends at St George. Segment 2 takes 3.0 minutes and ends at Spadina. For each one, add its minutes with `+=`, count the stop with `++`, and append the station to `route` with `+=`. The starter already does the `route` part of segment 1.
- Finally, compute `auto average = minutes / stops;` and print the four lines.
- The starter also has a line to try, `// int platform {2.5};`. Its comment says what to do. Along with the error you'll see two warnings: one says 2.5 would become 2, the other that `platform` is never used. The message marked **error** is the one that stops the build. The line stays commented out in the end.

```cpp starter
#include <iostream>
#include <string>

int main() {
    std::string route {"Union"};
    // TODO: an int called stops, starting at 0 (use {})
    // TODO: a double called minutes, starting at 0.0 (use {})

    // Segment 1: 4.5 minutes to St George
    route += " > St George";
    // TODO: add 4.5 to minutes, and count the stop

    // Segment 2: 3.0 minutes to Spadina
    // TODO: the same three steps

    // TODO: auto average = the minutes divided by the stops

    // Try this: delete the // at the start of the next line, tap Run
    // and read the error. Then put the // back.
    // int platform {2.5};

    std::cout << "Route: " << route << '\n';
    // TODO: print the Stops, Minutes and Average lines
}
```

The starter already compiles and runs. It prints just `Route: Union > St George`.

Once it passes, try this: change `double minutes {0.0};` to `auto minutes = 0;` and run again. `minutes` is now an `int`, so adding 4.5 keeps only the 4, and the average becomes integer division. You get `Minutes: 7` and `Average: 3`, without a single warning. That's why the type is written out here. Change it back afterwards.

```cpp solution
#include <iostream>
#include <string>

int main() {
    std::string route {"Union"};
    int stops {0};
    double minutes {0.0};

    // Segment 1: 4.5 minutes to St George
    route += " > St George";
    minutes += 4.5;
    ++stops;

    // Segment 2: 3.0 minutes to Spadina
    route += " > Spadina";
    minutes += 3.0;
    ++stops;

    auto average = minutes / stops;   // double / int is a double

    // int platform {2.5};   // error: 2.5 can't be narrowed to an int

    std::cout << "Route: " << route << '\n';
    std::cout << "Stops: " << stops << '\n';
    std::cout << "Minutes: " << minutes << '\n';
    std::cout << "Average: " << average << '\n';
}
```
