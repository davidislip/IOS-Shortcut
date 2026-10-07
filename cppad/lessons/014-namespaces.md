---
id: 14
title: Namespaces
concept: namespace definitions, qualified names, defining namespace members outside the braces, the global namespace and main, using-directives, using-declarations, name clashes and ambiguity, no using-directive in a header, nested namespaces, namespace aliases
minutes: 12
source: A Tour of C++
source_pages: 26-27
---
# Namespaces

Lesson 13 split a program into files. The parts of a big program also come from different people: your code, the standard library, maybe a library from somewhere else. Sooner or later two of them pick the same name, like `count`, `size` or `fare`.

Lesson 5 called a namespace a named scope, and lesson 1 showed the standard library's, `std`. Section 3.3 shows how to make your own: a label that groups related names, so they can't collide with names chosen by someone else.

## Your own namespace

```cpp
#include <iostream>

namespace Transit {
    constexpr int base_fare {325};   // cents for 1 zone

    int fare(int zones) {
        return base_fare + 50 * (zones - 1);   // same namespace: no prefix
    }
}

int main() {
    std::cout << Transit::fare(3) << '\n';     // 425
    std::cout << Transit::base_fare << '\n';   // 325
    // std::cout << fare(3) << '\n';           // error
}
```

- `namespace Transit { … }` puts everything between the braces into a namespace called `Transit`: constants, functions, structs, classes. No `;` is needed after the `}`, unlike a class.
- Inside the namespace, a member can use any name declared above it without a prefix. Unlike in a class, order matters: a namespace is read top to bottom, like a file.
- Outside, you write a **qualified name**: the namespace, `::`, then the member. `Transit::fare` works exactly like `std::cout`.
- Uncomment the last line and Clang says `use of undeclared identifier 'fare'; did you mean 'Transit::fare'?`. Outside `Transit`, a plain `fare` doesn't exist. That's the protection: someone else's `fare`, in their own namespace, can live in the same program.

A namespace is not a type: there are no `Transit` objects, only names grouped under one label. It can also be opened again later, even in another file, to add more names. That's how every standard header adds its names to the same `std`.

## Defining members outside the braces

The book's example (p. 26) tries out a home-made complex-number type (lesson 18 builds one). The standard library has a `complex` and a `sqrt` of its own, so the book puts its versions in a namespace called `My_code`. It even puts a `main` in there. Here is the same shape with a simpler type:

```cpp
#include <iostream>
#include <string>

namespace My_code {
    struct Stop {
        std::string name;
        int minute {0};    // minutes from the start of the line
    };
    int distance(const Stop& from, const Stop& to);
    int main();
}

int My_code::distance(const Stop& from, const Stop& to) {
    return to.minute - from.minute;
}

int My_code::main() {
    Stop a {"Union", 0};
    Stop b {"Bloor", 9};
    std::cout << a.name << " to " << b.name << ": " << distance(a, b) << " min\n";
    return 0;
}

int main() {                  // the real main
    return My_code::main();
}
```

It prints `Union to Bloor: 9 min`.

- The namespace block is the interface, the part that would go in a header: a type, and functions that are only declared, like the member functions in lesson 13's class. The definitions follow outside, named `My_code::distance` the way lesson 13 wrote `Vector::size()`.
- Once the compiler has read `My_code::`, it looks inside `My_code` for the names that follow, so `Stop` and `distance` need no prefix in those definitions. That's the point of the book's `My_code::main`: its test code uses `complex` and `sqrt` with no prefix and gets the book's versions, not std's. (The return type comes *before* `My_code::`, so a `Stop` there needs its prefix.)
- The program still starts at the real `main`, in the global namespace (lesson 5). It calls `My_code::main`, an ordinary function that happens to share the name, and returns its result as the exit status (lesson 1).
- Lesson 13's slips happen here too. A misspelt `My_code::distnace` gets `out-of-line definition of 'distnace' does not match any declaration in namespace 'My_code'`.
- Forget the prefix, writing `int fare(int zones) { … }` for a `fare` that `Transit` only declares, and you've made a new, global `fare`. Its body can't see `base_fare`: `use of undeclared identifier 'base_fare'; did you mean 'Transit::base_fare'?`. If it doesn't need it, the linker reports `undefined symbol: Transit::fare(int)`, like lesson 2's missing `cube`.

## `using`: dropping the prefix

Writing `Transit::` every time gets long. There are two ways to drop it:

```cpp
using namespace Transit;   // using-directive: every name in Transit
using Transit::fare;       // using-declaration: just this one name
```

- A **using-directive** is lesson 1's `using namespace std;`, for any namespace. (On p. 27, the book's `std::std` is a typo for `std::cout`.)
- A **using-declaration** brings in a single name: after `using std::cout;` you can write `cout`, but `std::string` still needs its prefix. If the name is an overloaded function, every version comes along.

Both last until the end of their scope (lesson 5): at the top of a file, the rest of the file; inside a function or block, only until that `}`.

They behave differently when the name already exists. Run this:

```cpp
#include <iostream>

namespace Metro {
    int fare(int zones) { return 325 + 50 * (zones - 1); }
}

int fare(int zones) { return 100 * zones; }   // an older, global fare

int main() {
    using std::cout;                 // just cout
    cout << fare(2) << '\n';         // 200: the global one
    {
        using Metro::fare;           // declares fare in this block...
        cout << fare(2) << '\n';     // 375: ...and shadows the global one
    }
    cout << fare(2) << '\n';         // 200: that block has ended
    {
        using namespace Metro;       // Metro's fare meets the global one
        // cout << fare(2) << '\n';  // error: call to 'fare' is ambiguous
    }
}
```

`using Metro::fare;` declares `fare` in that block, so it shadows the global one (lesson 5). `using namespace Metro;` declares nothing: Metro's names just become findable, as if declared out in the global namespace, next to the old `fare`. (The book's "as if they were local" is a simplification.) Uncomment the last `cout` line: neither `fare` wins, and Clang lists both as `candidate function`. It's the same refusal to guess as lesson 2's `show(1, 4)`.

## When names clash

That last error is the danger of `using namespace std;`. The library has hundreds of names, and you don't know them all:

```cpp
#include <algorithm>    // declares std::count, among many others
using namespace std;

int count {0};          // your own global counter

void tap() {
    ++count;            // error: reference to 'count' is ambiguous
}
```

> ⚠️ **`using namespace std;` can break your own names.** `<algorithm>` has a function `std::count` (the book gets to it later), and the directive lets it meet your global `count`. The notes name both candidates, `'count'` and `'std::count'`. You never asked for `std::count`, yet it broke your code. This is the clash lesson 1 promised that writing `std::` avoids.

## Where `using` belongs

The book's advice (p. 31) comes down to this:

- Use namespaces to show the structure of a program: related declarations go in one.
- Keep using-directives for `std` or a similar foundational library, for converting older code written before namespaces existed, or for a function or block, where a clash stays inside that `}`. The book's examples put `using namespace std;` in `.cpp` files. These lessons still write `std::`, for the reason above.
- **Never put a using-directive in a header.** `#include` pastes the header's text into every file that includes it (lesson 13). A `using namespace` in a header lands at the top of all those files, and none of them can undo it. Clashes then turn up in files that never asked for them.

A using-declaration inside a function, like the exercise's step 4, is the light option: one name, one block. Neither kind goes at the top of a header.

## Nested namespaces and aliases

Big libraries put namespaces inside namespaces. The standard library's clock and timing tools, for example, are in `std::chrono`. Since C++17 you can define a nested one in one go, and any namespace can get a short second name, an **alias**:

```cpp
// C++17 short form of namespace Transit { namespace Fares { … } }
namespace Transit::Fares {
    constexpr int adult {325};
}

namespace tf = Transit::Fares;  // tf is a second name for Transit::Fares

int single {tf::adult};         // the same as Transit::Fares::adult
```

## Exercise: Metro and bus fares

A Metro ride costs 325 cents for one zone plus 50 for each extra zone (lesson 5's fare). A bus ride is 300 cents, however many zones. Make the program print:

```expected
Metro, 1 zone: 325
Bus, 1 zone: 300
Metro, 3 zones: 425
Bus, 3 zones: 300
with using: 375
```

Without namespaces, the only way to keep two `fare` functions apart is a prefix, `metro_fare` and `bus_fare`. That's how the starter does it, and how C code still does. Replace the prefixes with namespaces:

1. Put the three Metro things into `namespace Metro`, and the three Bus things into `namespace Bus`. Drop the prefixes: each namespace then has its own `base_fare`, `fare` and `name`.
2. In `Bus`, keep only the declaration `int fare(int zones);`. Define the function below the namespace block as `int Bus::fare(int)`. (The bus ignores the zones, so leave the parameter unnamed, as lesson 2's declarations could: a named one would get the warning `unused parameter 'zones'`.)
3. In `main`, print the four table lines with qualified names: `Metro::name()`, `Metro::fare(1)` and so on.
4. In the inner block, add `using Metro::fare;` and print `with using: <fare>`, calling `fare(2)` with no prefix.
5. Once it passes, try the three commented lines at the end of `main`: uncomment them, tap **Run**, read the error, then comment them out again.

The starter runs and prints only the first line. After step 1, its `main` stops compiling: `use of undeclared identifier 'metro_name'`, and the same for `metro_fare`. That's normal after a rename, and step 3 fixes it. If you forget `Bus::` in step 2, you get the error from above, `use of undeclared identifier 'base_fare'`, with no "did you mean" this time: there are two `base_fare`s to choose from.

```cpp starter
#include <iostream>
#include <string>

// TODO 1: put these three into namespace Metro and drop the prefix
constexpr int metro_base_fare {325};

int metro_fare(int zones) {
    return metro_base_fare + 50 * (zones - 1);
}

std::string metro_name() { return "Metro"; }

// TODO 1: ...and these three into namespace Bus
// TODO 2: in the namespace, only declare int fare(int zones);
//         then define it below the namespace block as Bus::fare
constexpr int bus_base_fare {300};

int bus_fare(int) {   // a flat fare: the zones don't matter
    return bus_base_fare;
}

std::string bus_name() { return "Bus"; }

int main() {
    // TODO 3: qualified names, and all four lines of the table
    std::cout << metro_name() << ", 1 zone: " << metro_fare(1) << '\n';

    {
        // TODO 4: using Metro::fare; then print "with using: " and fare(2)
    }

    // Try: two using-directives, two fares
    // using namespace Metro;
    // using namespace Bus;
    // std::cout << fare(1) << '\n';
}
```

```cpp solution
#include <iostream>
#include <string>

namespace Metro {
    constexpr int base_fare {325};

    int fare(int zones) {
        return base_fare + 50 * (zones - 1);
    }

    std::string name() { return "Metro"; }
}

namespace Bus {
    constexpr int base_fare {300};
    int fare(int zones);                 // defined below
    std::string name() { return "Bus"; }
}

int Bus::fare(int) {   // a flat fare: the zones don't matter
    return base_fare;  // Bus::base_fare: this is Bus's function
}

int main() {
    std::cout << Metro::name() << ", 1 zone: " << Metro::fare(1) << '\n';
    std::cout << Bus::name() << ", 1 zone: " << Bus::fare(1) << '\n';
    std::cout << Metro::name() << ", 3 zones: " << Metro::fare(3) << '\n';
    std::cout << Bus::name() << ", 3 zones: " << Bus::fare(3) << '\n';

    {
        using Metro::fare;
        std::cout << "with using: " << fare(2) << '\n';
    }

    // Try: two using-directives, two fares
    // using namespace Metro;
    // using namespace Bus;
    // std::cout << fare(1) << '\n';
}
```

The Try lines give the `call to 'fare' is ambiguous` error from the `using` section: two directives, two equally good `fare`s.

That's all of section 3.3. Section 3.4 (p. 27) asks what a function should do when it finds an error it can't fix itself.
