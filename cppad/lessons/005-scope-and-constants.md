---
id: 5
title: Scope and constants
concept: scope, blocks, global and member names, namespaces, shadowing, lifetime, const, constexpr, constant expressions, constexpr functions, named constants
minutes: 12
source: A Tour of C++
source_pages: 8-9
---
# Scope and constants

This lesson answers three questions about names. **Where** can you use a name? **How long** does the object behind it exist? And **can its value ever change?**

## Scope: where a name can be used

A name's **scope** is the part of the program where you can use it. A name declared inside a function is a **local** name. You can use it from its declaration down to the `}` that closes the block it's in. A **block** is any `{ }` pair, and a function's body is a block. Parameters are local names too. (The book also mentions *lambdas*, small unnamed functions that come later in the book. Names declared inside them are local too.)

```cpp
#include <iostream>
#include <string>

void greet(std::string rider) {              // rider is local to greet
    std::string hello {"Welcome aboard, "};  // so is hello
    std::cout << hello << rider << '\n';
}

int main() {
    greet("Sam");   // converted to a std::string, like square(3) in lesson 2
    // std::cout << hello;   // error: hello only exists inside greet
}
```

Uncomment that line and Clang says `use of undeclared identifier 'hello'`. You saw the same error in lesson 2, when you called a function before its declaration. Outside its scope, a name doesn't exist as far as the compiler is concerned.

You can also open a block anywhere inside a function, to keep a name around only as long as you need it:

```cpp
#include <iostream>

int main() {
    int stops {3};
    {
        int minutes {stops * 2};   // minutes exists only inside this block
        std::cout << minutes << " minutes\n";
    }
    std::cout << stops << " stops\n";   // fine: stops is still in scope
    // std::cout << minutes;            // error: its block has ended
}
```

The bodies of loops and `if` statements (lessons 6 and 8) are blocks too, so the same rule applies to them.

> 💡 Keep scopes small. If a name is only visible in five lines, you only have to check those five lines when it holds a wrong value.

## Where names live

Here is a version of the book's example on p. 8, with a comment on each name:

```cpp
int total_trips {0};                    // global: outside everything

struct Record {                         // a type you define (lesson 10)
    std::string name;                   // member: belongs to Record
};

void fct(int arg) {                     // fct is global; arg is local
    std::string motto {"Mind the gap"}; // local to fct
}
```

| Kind | Declared… | Usable… |
| --- | --- | --- |
| local | in a function (parameters too) | from its declaration to the end of its block |
| member | in a `struct` or `class` | inside that type; from outside through an object, like `r.name` (lessons 10–11) |
| namespace | in a namespace, like `std` | inside it; from outside as `std::cout` |
| global | outside everything | from its declaration to the end of the file |

- A **namespace** is a named scope. `std` holds the standard library, so `std::cout` means "the `cout` that lives in `std`". Lesson 1 showed how `using namespace std;` drops the prefix. Making your own namespaces comes later in the book.
- Global names live in the **global namespace**, the outermost one. Your functions are global names too. `main` can call `greet` because `greet` is global and declared above it (lesson 2).

> 💡 Global *constants* (coming up below) are fine. Global *variables* like `total_trips` are risky: every function can change them, so when one holds a wrong value, every function is a suspect.

## Shadowing

A name declared in an inner scope **shadows** (hides) the same name from an outer scope. The inner one is a different variable:

```cpp
#include <iostream>

int main() {
    int minutes {10};
    {
        int minutes {3};    // a NEW variable that hides the outer one
        minutes += 5;
        std::cout << minutes << '\n';   // 8
    }
    std::cout << minutes << '\n';       // 10: the outer one never changed
}
```

> ⚠️ **A stray type makes a new variable.** Say you meant to *change* the outer `minutes`: set it to 3, then add 5. Writing `int minutes {3};` instead of `minutes = 3;` declares a second variable that disappears at the `}`, and the outer one still says 10. Clang doesn't warn about this with the app's flags. Once a name exists, use it without a type.

## Lifetime: when an object exists

Scope is about where you can *write* a name. **Lifetime** is about when the object behind it *exists* while the program runs.

A local object is created when the program reaches its declaration and destroyed at the end of its block. So each call to a function gets brand-new locals:

```cpp
#include <iostream>

void tap() {
    int taps {0};
    ++taps;
    std::cout << "taps: " << taps << '\n';
}

int main() {
    tap();   // taps: 1
    tap();   // taps: 1 again: a fresh taps, starting at 0
}
```

- A **global** object lives until the program ends. A global `int` with no initializer starts at 0, not garbage, but still write the `{0}`.
- A **member** lives as long as the object it belongs to.

**Objects with no name.** The book's example also has `auto p = new Record{"Hume"};`. `new` creates an object that has no name and belongs to no scope. `p` just remembers where in memory it is (pointers are lesson 8). The object lives until `delete` destroys it. If nobody does, its memory isn't given back until the program ends: a **memory leak**. Modern code rarely writes `new`. Types like `std::string` and `std::vector` (lesson 6) use it inside, and give the memory back by themselves when the program reaches the end of their scope, at the closing `}`. You write no cleanup code.

## `const`: "I promise not to change this"

```cpp
const int stations {75};
stations = 76;   // error
```

Clang refuses: `cannot assign to variable 'stations' with const-qualified type 'const int'`. (*const-qualified* just means "marked `const`".)

Why make the promise? A reader knows the value stays the same all the way down, and if you change it by mistake, the build fails instead of the program quietly printing a wrong number.

A `const` must get its value in its declaration, because there's no way to set it later. That value can be worked out while the program runs, but once it's set, it's fixed.

`const` is used most in function parameters, where a function promises not to change what you pass it. That's lesson 7.

## `constexpr`: "work it out while compiling"

`constexpr` goes further: the value must be known **at compile time**, while Clang is turning your code into a program. The compiler calculates it and builds the result into the program.

```cpp
constexpr int minutes_per_hour {60};
constexpr int minutes_per_day {24 * minutes_per_hour};   // the compiler computes 1440
```

A **constant expression** is one the language rules guarantee the compiler can work out on its own. It's built from literals, `constexpr` variables, and calls to `constexpr` functions (next section) whose arguments are constant expressions too. An ordinary variable doesn't count, even if you can see its value:

```cpp
int riders {80};
constexpr int seats {riders * 2};   // error
```

Clang says `constexpr variable 'seats' must be initialized by a constant expression`, and a note explains why: `read of non-const variable 'riders' is not allowed in a constant expression`.

Notice the word *non-const*. A `const int` set from a constant does count, which is why the book's `const int dmv = 17;` on p. 9 works in a constant expression. That exception only covers whole-number types like `int` (a `const double` doesn't count), so don't rely on it: write `constexpr` whenever you mean "known while compiling".

Why bother?

- Nothing is left to compute when the program runs.
- The compiler can build the value straight into the code, or (on most desktop systems) put it in read-only memory, so a bug elsewhere has a hard time corrupting it.
- Some places *require* a constant expression: the size of an array (lesson 6) and the labels of a `switch` (lesson 9).

## `constexpr` functions

To use a function in a constant expression, declare it `constexpr`. Here is lesson 2's `square`:

```cpp
#include <iostream>

constexpr double square(double x) {
    return x * x;
}

int main() {
    constexpr double tile {square(1.5)};   // compile time: 1.5 is a constant
    double side {2.5};
    const double room {square(side)};      // run time: side is an ordinary variable
    // constexpr double oops {square(side)};   // error: side isn't a constant
    std::cout << tile << " and " << room << '\n';   // 2.25 and 6.25
}
```

One definition covers both jobs. When a constant is needed and every argument is constant, the compiler must run it while compiling. Anywhere else it's allowed to run as an ordinary call when the program runs, like `room` above.

The book (C++11) says a `constexpr` function must be just a `return` statement. That rule is gone: since C++14 the body may also have local variables, `if` and loops (lessons 6 and 8).

So which one should you use?

- `constexpr` when the value is known while compiling.
- `const` when the value is only known at run time but mustn't change afterwards.
- A plain variable when it really does change.

## Name your numbers

A number with no explanation in the middle of the code is a **magic number**:

```cpp
std::cout << 325 + 50 * 2;                           // what are 325, 50 and 2?
std::cout << base_fare + zone_extra * extra_zones;   // obvious
```

With named constants, the code explains itself, and when the fare goes up you change it in one place.

> 💡 Name constants like any other variable: `base_fare`, not `BASE_FARE`. The book's advice is to avoid ALL_CAPS names: by tradition they belong to *macros*, a text-replacement feature inherited from C.

## Exercise: Fare table

A fare is 325 cents for one zone, plus 50 cents for each extra zone. Make the program print:

```expected
1 zone: 325 cents
2 zones: 375 cents
today (3 zones): 425 cents
```

1. Add two global `constexpr int` constants: `base_fare` (325) and `zone_extra` (50).
2. Replace the magic numbers in `fare` with them, and make `fare` a `constexpr` function.
3. In `main`, make `one` a `constexpr`, and add a `constexpr` called `two` for 2 zones. Print it.
4. In the "today" block, add `today`, set to `fare(zones_today)`. It can't be `constexpr`, because `zones_today` is an ordinary (non-const) variable: in a real app it would come from the card reader, so keep it a plain `int`. Make `today` `const`, and print it instead of the `?`.
5. Try the two lines marked **Try**, one at a time: uncomment, tap **Run**, read the error, then comment it out again. The first gives the `must be initialized by a constant expression` error from above, with the note `read of non-const variable 'zones_today' is not allowed in a constant expression`. The second gives `use of undeclared identifier 'today'`: its block has ended.

If you do step 3 before step 2, Clang says `constexpr variable 'one' must be initialized by a constant expression`, and the note under it gives the reason: `non-constexpr function 'fare' cannot be used in a constant expression`. That's step 2 telling you it's still to do.

```cpp starter
#include <iostream>

// TODO 1: global constexpr constants base_fare (325) and zone_extra (50)

// TODO 2: use the constants, then make fare constexpr
int fare(int zones) {
    return 325 + 50 * (zones - 1);
}

int main() {
    // TODO 3: make one constexpr; add a constexpr two (2 zones) and print it
    int one {fare(1)};
    std::cout << "1 zone: " << one << " cents\n";

    {   // today's trip
        int zones_today {3};   // read from the card: keep it a plain int
        // TODO 4: a const today = fare(zones_today); print it instead of ?
        std::cout << "today (" << zones_today << " zones): ? cents\n";

        // Try: constexpr needs a constant expression
        // constexpr int bad {fare(zones_today)};
    }

    // Try: today's block has ended
    // std::cout << today << " cents\n";
}
```

```cpp solution
#include <iostream>

constexpr int base_fare {325};   // cents for 1 zone
constexpr int zone_extra {50};   // cents for each extra zone

constexpr int fare(int zones) {
    return base_fare + zone_extra * (zones - 1);
}

int main() {
    constexpr int one {fare(1)};
    constexpr int two {fare(2)};
    std::cout << "1 zone: " << one << " cents\n";
    std::cout << "2 zones: " << two << " cents\n";

    {   // today's trip
        int zones_today {3};   // read from the card: keep it a plain int
        const int today {fare(zones_today)};
        std::cout << "today (" << zones_today << " zones): " << today << " cents\n";

        // Try: constexpr needs a constant expression
        // constexpr int bad {fare(zones_today)};
    }

    // Try: today's block has ended
    // std::cout << today << " cents\n";
}
```

The compiler worked out `one` and `two`; `today` was worked out when the program ran. Once set, none of them can change.

Once it passes, add `int zones_today {1};` on the line after `int zones_today {3};` and tap **Run**. Clang says `redefinition of 'zones_today'`: in the *same* scope a name can be declared only once. Only an inner block can shadow it. Delete the line again.
