---
id: 15
title: Errors, exceptions and std::optional
concept: run-time errors, error-handling strategy, exceptions, throw, try-block, catch-clause, std::out_of_range, unwinding, noexcept, std::terminate, -fno-exceptions, vector::at, std::optional, std::nullopt, value_or
minutes: 15
source: A Tour of C++
source_pages: 27-28
---
# Errors, exceptions and std::optional

Lesson 11 left the book's `Vector` with a gap: nothing stops `v[7]` on a six-element Vector, and what happens then is undefined behaviour (lesson 2). The book fills the gap in §3.4 with exceptions, which this app can't run. This lesson shows what they are and how to read them, then the replacement lesson 11 promised: `std::optional`.

## Found in one place, handled in another

Who could deal with a bad index?

- The **writer** of `Vector` can spot a bad index with one comparison against `sz`. But the same Vector might end up in a trip planner, a game or a bank. Print a message? Use 0? Give up? Only the program using it can say.
- The **user** of `Vector` knows what the program should do. But a bad index is nearly always a bug nobody has noticed yet, so you can't count on the user checking every index first.

So a **run-time error**, one that shows up while the program runs, is often detected in one place and handled somewhere else, maybe several calls away. With separate parts and libraries (lessons 13 and 14) that distance grows, which is why the book advises choosing an **error-handling strategy** early: one agreed way for every part of the program to report and handle errors.

(The first defence is the type system, like lesson 12's `enum class`; this lesson is about errors no compiler can see.)

## Exceptions: the book's answer

The book's strategy is exceptions. Here's its checked `operator[]` from p. 28, defined outside the class as in lesson 13:

```cpp
double& Vector::operator[](int i) {
    if (i < 0 || size() <= i) {
        throw std::out_of_range{"Vector::operator[]"};
    }
    return elem[i];
}
```

The test says: `i` must be at least 0 and less than `size()`. If it isn't, `std::out_of_range{"Vector::operator[]"}` makes an object describing the error: a `std::out_of_range` (from `<stdexcept>`) holding a short message. It's made like `Train a {"Yonge", 6};` in lesson 11, just without a variable name. **`throw`** sends that object, the **exception**, back up to the callers. `operator[]` stops at the `throw`: the `return` never runs.

Somewhere up the chain of calls, one level or ten, a function can catch it:

```cpp
void f(Vector& v) {
    try {                                     // errors in here...
        v[v.size()] = 7;                      // one past the end
        std::cout << "stored\n";              // skipped
    }
    catch (const std::out_of_range& e) {      // ...are handled here
        std::cout << "range error: " << e.what() << '\n';
    }
    std::cout << "f carries on\n";            // runs either way
}
```

- The **try-block** holds the code whose errors you want to handle.
- The **catch-clause** after it is the **handler**. It runs only if an exception of its type comes out of the try-block. `e.what()` is the exception's message, here `Vector::operator[]`.
- Between the `throw` and the handler, the program leaves every function and block on the way, as if each had returned early, and cleans up their local variables as it goes (lesson 19 shows how). The chain of calls that led to the `throw` is the **call stack**; going back up it like this is **unwinding** it.
- The rest of the try-block is skipped. When the handler finishes, the program carries on after the catch-clause; it never goes back to the `throw`. So `f` prints `range error: Vector::operator[]`, then `f carries on`, and never `stored`.

The book writes `catch (out_of_range)`, which catches a copy and gives it no name. Modern code catches by `const&` (lesson 7): no copy, and a name to ask for the message.

Why do people like exceptions? An error can't be silently ignored, the way an unchecked `bool` can: if nobody catches it, the program stops. The functions in between need no error-handling code, and the normal path stays uncluttered. The book adds a warning: don't overuse try-blocks. Most functions should let exceptions pass through to the one place that can handle them. The book's main technique for keeping this simple, RAII, is lesson 19.

A function can also promise never to throw, with **`noexcept`**:

```cpp
void user(Vector& v) noexcept {
    v[v.size()] = 7;   // throws, but user() promised not to: std::terminate()
}
```

If an exception tries to leave a `noexcept` function anyway, no handler gets a chance: the program calls `std::terminate()` and stops at once.

## Exceptions in this app: switched off

This app compiles every program with one more flag than the terminal shows, `-fno-exceptions`, because its standard library was built without exception support. Many games and embedded systems are built the same way, to keep programs small and predictable. So `throw`, `try` and `catch` don't compile here: Clang says `cannot use 'throw' with exceptions disabled` (and the same for `try`), and the app adds a hint pointing to `std::optional` and `std::expected`. That's why the examples above have no `main`. (`noexcept` on its own is fine here; lesson 25 uses it.)

Exceptions are still C++'s standard tool, and the book keeps using them: these lessons show them as fragments and practise the alternatives.

Here, standard-library code that would throw stops the program instead. `std::vector` has a checked version of `[ ]`, called `at()`:

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> delays {0, 4, 2};
    std::cout << delays.at(1) << '\n';   // 4: at() checks the index, then reads
    std::cout << delays.at(5) << '\n';   // no element 5
    std::cout << "never printed\n";
}
```

Tap **Open in editor** and **▶ Run**. It prints `4`; then `delays.at(5)` would throw `std::out_of_range`, can't, and the terminal shows `out_of_range was thrown in -fno-exceptions mode with message "vector"`, then 💥 Program aborted. It's the kind of message `std::get` gave in lesson 12.

A clear stop beats undefined behaviour (`delays[5]` might print junk and carry on), but nobody gets to handle the error. For that, a function needs to say "no value" in what it returns.

## `std::optional`: a value, or nothing

Lesson 11's `tap` reported failure with a `bool`. That works when there's nothing to hand back. When there is, use **`std::optional`** (C++17, from `<optional>`): a `std::optional<int>` holds either one `int` or nothing at all, and any type can go in the `< >`.

```cpp
#include <iostream>
#include <optional>
#include <vector>

// How late train i is, or nothing if there's no train i.
std::optional<int> delay_of(const std::vector<int>& delays, int i) {
    if (i < 0 || i >= std::ssize(delays)) {
        return std::nullopt;             // no such train: an empty optional
    }
    return delays[i];                    // an optional holding the int
}

int main() {
    std::vector<int> delays {0, 4, 2};   // minutes late: trains 0, 1 and 2
    std::optional<int> d {delay_of(delays, 1)};
    if (d) {
        std::cout << "train 1: " << *d << " min late\n";   // train 1: 4 min late
    }
    if (!delay_of(delays, 7)) {                             // empty: no train 7
        std::cout << "train 7: no such train\n";
    }
}
```

- The test is the book's `operator[]` test, with `return std::nullopt;` where the book has `throw`. The function detects the error; the caller decides what to do about it.
- `return delays[i];` returns an `int`, which becomes an optional holding it.
- `std::nullopt` ("null optional") is the empty value, the optional's version of `nullptr` (lesson 8).
- `std::ssize(delays)` (C++20) is the size as a signed number, so comparing it with the `int i` doesn't give lesson 6's "different signs" warning.

What you can do with an optional `d`:

| Write | Means |
| --- | --- |
| `if (d)` | does it hold a value? (even 0 counts; `if (!d)`: is it empty?) |
| `*d` | the value inside, unchecked |
| `d.value()` | the value inside, checked |
| `d.value_or(0)` | the value inside, or 0 if it's empty |

Why not return `-1` for "no such train", as older code often does? A `-1` is a magic number (lesson 5): nothing stops a caller from adding it to a total. You can't do arithmetic on an optional by mistake: `d + 1` doesn't compile, so you have to unwrap it first, and that's the moment you think about the empty case. One trap: comparisons compile, and an empty optional counts as less than any number, so `delay_of(delays, 7) < 5` is true for a train that doesn't exist.

> ⚠️ `*d` doesn't check. On an empty optional it's undefined behaviour, like `*p` on a `nullptr` (lesson 8). `d.value()` checks, but on an empty optional it throws, so here it stops the program with `bad_optional_access was thrown in -fno-exceptions mode`. Test with `if` before you use `*`, or use `value_or` with a default that makes sense.

With exceptions out, that's the strategy these lessons follow: a function that may have nothing to return says so in its return type, and the caller checks. Lesson 16 adds a type that also says *why*.

## Exercise: Which stop?

The Yonge line going north from Union is stored as a vector of station names. Write two functions that can fail, and a `main` that deals with the failures:

1. `stop_number(line, name)`: the position of `name` on the line, counting from 1 (Union is stop 1), or `std::nullopt` if it isn't on the line. Walk the line with a range-for, keeping an `int` count that starts at 1 and goes up by 1 after each station.
2. `stop_name(line, number)`: the name of stop `number`, checked first: `std::nullopt` unless `number` is from 1 to the size of `line` (`std::ssize`, as in `delay_of`). Stop `number` is at index `number - 1`.
3. In `main`'s loop, call `stop_number` for each name read. Print `<name>: stop <number>` if it found one, otherwise `<name>: not on this line`.
4. After the loop, print `stop 2:` and `stop 9:`, each followed by a space and `stop_name(...)` with `.value_or("none")`.

On **▶ Run**, type three station names and press return; **Check** feeds in the line below (lesson 9).

```stdin
Dundas Spadina Union
```

```expected
Dundas: stop 4
Spadina: not on this line
Union: stop 1
stop 2: King
stop 9: none
```

The starter compiles and prints nothing yet (Clang warns about unused parameters until you fill the functions in).

```cpp starter
#include <iostream>
#include <optional>
#include <string>
#include <vector>

// Where name is on the line, counting from 1, or nothing.
std::optional<int> stop_number(const std::vector<std::string>& line,
                               const std::string& name) {
    // TODO 1: count along the line with a range-for; return the count
    //         when the station equals name.
    return std::nullopt;
}

// The name of stop number (1 is the first stop), or nothing.
std::optional<std::string> stop_name(const std::vector<std::string>& line,
                                     int number) {
    // TODO 2: return std::nullopt unless number is from 1 to the size
    //         of line (std::ssize); otherwise the name at number - 1.
    return std::nullopt;
}

int main() {
    const std::vector<std::string> line {"Union", "King", "Queen", "Dundas",
                                         "College", "Wellesley", "Bloor"};
    for (int i = 0; i < 3; ++i) {
        std::string name;
        std::cin >> name;
        // TODO 3: call stop_number. Print "<name>: stop <number>" if it
        //         found the station, otherwise "<name>: not on this line".
    }
    // TODO 4: print "stop 2: " and "stop 9: ", each followed by
    //         stop_name(...) with .value_or("none").
}
```

```cpp solution
#include <iostream>
#include <optional>
#include <string>
#include <vector>

// Where name is on the line, counting from 1, or nothing.
std::optional<int> stop_number(const std::vector<std::string>& line,
                               const std::string& name) {
    int number {1};
    for (const auto& station : line) {
        if (station == name) {
            return number;
        }
        ++number;
    }
    return std::nullopt;             // went through the whole line: not there
}

// The name of stop number (1 is the first stop), or nothing.
std::optional<std::string> stop_name(const std::vector<std::string>& line,
                                     int number) {
    if (number < 1 || number > std::ssize(line)) {
        return std::nullopt;
    }
    return line[number - 1];         // stop 1 is at index 0
}

int main() {
    const std::vector<std::string> line {"Union", "King", "Queen", "Dundas",
                                         "College", "Wellesley", "Bloor"};
    for (int i = 0; i < 3; ++i) {
        std::string name;
        std::cin >> name;
        std::optional<int> stop {stop_number(line, name)};
        if (stop) {
            std::cout << name << ": stop " << *stop << '\n';
        } else {
            std::cout << name << ": not on this line\n";
        }
    }
    std::cout << "stop 2: " << stop_name(line, 2).value_or("none") << '\n';
    std::cout << "stop 9: " << stop_name(line, 9).value_or("none") << '\n';
}
```

Once it passes, change `.value_or("none")` on the `stop 9` line to `.value()` and tap **▶ Run** (type the three names again): `bad_optional_access was thrown in -fno-exceptions mode`, then 💥 Program aborted. That's the stop the `if` and `value_or` protect you from. Put `value_or` back afterwards.
