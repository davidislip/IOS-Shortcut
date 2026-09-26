---
id: 12
title: Unions and enumerations
concept: enum class, enumerators, scoped and strongly typed enums, operators on an enum, switch on an enum, -Wswitch, plain enum, union, tagged union, std::variant
minutes: 14
source: A Tour of C++
source_pages: 19-22
---
# Unions and enumerations

Lessons 10 and 11 built new types with `struct` and `class`. This lesson finishes the book's chapter 2 with the second kind of user-defined type lesson 10 mentioned, the **enumeration**, plus the **union**, a special kind of struct:

- An **enumeration** is a type whose values you list by name, like the states of a train door.
- A **union** holds one value at a time, of one of several types, in the space of the biggest one.

The book starts with unions (p. 19). This lesson starts with enumerations (p. 20), because a union usually comes with one to keep track of what it holds, and you'll use enumerations far more often.

## `enum class`: a type with named values

Say a program tracks a subway signal. You could use an `int`: 0 for green, 1 for yellow, 2 for red. But then `signal = 7` compiles, and every reader has to remember what 2 means: magic numbers again (lesson 5). An **enumeration** lists the values instead:

```cpp
#include <iostream>

enum class Signal { green, yellow, red };

int main() {
    Signal s {Signal::red};
    if (s == Signal::red) {
        std::cout << "stop\n";
    }
    s = Signal::green;
    if (s != Signal::red) {
        std::cout << "go\n";
    }
}
```

- `enum class Signal { green, yellow, red };` declares a new type, `Signal`. Like a struct, it ends with `;`.
- `green`, `yellow` and `red` are its **enumerators**: the named values a `Signal` is meant to have.
- You write an enumerator with its type's name in front: `Signal::red`.

Out of the box, an enum class can be initialized, assigned, and compared with `==`, `!=`, `<` and the rest. `<` follows the order of the list, so `Signal::green < Signal::red` is true. Nothing else works: no arithmetic, not even `++`, and not even printing. `std::cout << s` is an error (a very long one). You'll fix both below.

## Scoped and strongly typed

The `class` in `enum class` buys you two things.

The enumerators are **scoped**: they live inside their enum, the way members live inside a struct (lesson 10). So two enums can use the same names. The subway's line colours include a yellow and a green too:

```cpp
enum class Signal { green, yellow, red };
enum class Line_color { yellow, green, purple };

Signal a {Signal::green};    // OK
Signal b {green};            // error: no green out here
```

For `b`, Clang says `use of undeclared identifier 'green'`: outside their enums, there is no `green`. `Signal::green` and `Line_color::green` are two different values that happen to share a name.

And the enum is **strongly typed**: it's a separate type that doesn't mix with other enums or with integers. Take a function that sets a signal:

```cpp
void set_signal(Signal s);

set_signal(Signal::red);         // OK
set_signal(Line_color::green);   // error: wrong enum
set_signal(2);                   // error: 2 is not a Signal
```

Both errors say `no matching function for call to 'set_signal'`, and the note under each gives the reason: `no known conversion from 'Line_color' to 'Signal'` (or `from 'int'`).

It works the other way round too. `int i = Signal::red;` fails with `cannot initialize a variable of type 'int' with an rvalue of type 'Signal'`. An *rvalue* is the opposite of an lvalue (lesson 7): a plain value such as `2` or `Signal::red`, not an object with a place in memory. (It's the word from lesson 8's `nullptr` error, too.)

Why is that good? A function that takes a `Signal` can only be handed a `Signal`. A line colour or a stray number passed by mistake is a compile error, not a bug on the train.

(One loophole: with braces and no `=`, `Signal d {2};` compiles and makes `Signal::red`. So does `Signal d {7};`, although no enumerator is 7. C++17 added this so that an enum can serve as a distinct kind of number. `Signal d = 2;` and `set_signal(2)` are still errors. Stick to the enumerators.)

## Giving an enum operations

`Signal` is your own type, so you're free to give it functions, and operators too, the way lesson 11 gave a class `operator[]`. The natural tool is a `switch` (lesson 9), with one `case` per enumerator.

First, printing. `std::cout` doesn't know your enum, so write a function that turns each value into text:

```cpp
std::string name(Signal s) {
    switch (s) {
    case Signal::green:  return "green";
    case Signal::yellow: return "yellow";
    case Signal::red:    return "red";
    }
    return "?";   // only for a Signal with no name
}
```

Why the last `return`, when the cases cover every enumerator? Because a `Signal` can still hold a number with no name: the loophole above makes `Signal w {7};` legal. Without that line, `name(w)` would run off the end of the function, which is undefined behaviour (lesson 2), and this app stops with 💥 Program aborted. Clang doesn't warn about it, because the switch lists every enumerator (GCC does warn). The extra `return` costs nothing.

Next, an operator. Here `++` moves a signal on to the next colour:

```cpp
Signal& operator++(Signal& s) {    // ++s: move s to the next signal
    switch (s) {
    case Signal::green:  s = Signal::yellow; break;
    case Signal::yellow: s = Signal::red;    break;
    case Signal::red:    s = Signal::green;  break;
    }
    return s;
}
```

- An enum can't have member functions, so `operator++` is an ordinary function outside it.
- With one parameter, it defines the **prefix** form: `++s`.
- The parameter is a `Signal&` because `++` changes the caller's variable (lesson 7).
- It returns `s` itself, so `++s` works inside a bigger expression, as it does for an `int`: `Signal next {++s};`.

The book writes each case as `return t = Traffic_light::yellow;`. An assignment gives back the variable it assigned to, so that one line sets `t` and returns it.

The postfix form `s++` is a separate operator that you haven't defined, so it's still an error: `cannot increment expression of enum type 'Signal'`.

> 💡 Don't put a `default:` in a switch on an enum. Without one, if you later add an enumerator, say `flashing`, Clang warns at every switch that forgot it: `enumeration value 'flashing' not handled in switch`. That's the `-Wswitch` warning, and a `default:` would silence it. (A `return` after the switch, like the one in `name`, doesn't.)

## Plain enums: the older style

Leave out `class` and you get a **plain enum**, the kind C++ inherited from C:

```cpp
enum Direction { northbound, southbound, eastbound, westbound };

int dir = southbound;    // OK: dir is 1
```

- Its enumerators leak into the surrounding scope: you can write plain `southbound` (`Direction::southbound` works too). So two plain enums in the same scope can't both have a `southbound`.
- They turn into `int`s without being asked: `southbound + 1` is 2.
- The values count up from 0: `northbound` is 0, `southbound` 1, `eastbound` 2, `westbound` 3.

Plain enums are everywhere in older code, so you'll meet them. For your own code, the book's advice: prefer `enum class`, for fewer surprises. An enum class has the same numbers inside, but only gives them up when you ask: `static_cast<int>(Signal::red)` is 2 (`static_cast`, the explicit conversion lesson 4 mentioned).

## Unions: one value, several possible types

A countdown on a platform screen shows either how many **stops** away the train is (an `int`) or how many **minutes** (a `double`), never both. A struct would keep room for both. A **union** puts all its members at the same spot in memory, so its size is set by its biggest member instead of the total. Storing into one member wipes out whatever the others held: only the member you wrote last has a value.

```cpp
union Value {
    int stops;
    double minutes;
};
```

`sizeof(Value)` is 8 on this iPad, the size of a `double`, its biggest member (lesson 3). A struct holding both would take 16.

Nothing inside a union says which member holds the value. Keeping track is your job, usually with a **type field** stored beside it, often an enum:

```cpp
enum class Kind { stops, minutes };

struct Countdown {
    std::string line;
    Kind kind {Kind::stops};   // which member of v is in use
    Value v {};                // {} starts v.stops at 0
};

void show(const Countdown& c) {
    if (c.kind == Kind::stops) {
        std::cout << c.line << ": " << c.v.stops << " stops away\n";
    } else {
        std::cout << c.line << ": " << c.v.minutes << " min\n";
    }
}
```

A union plus a type field is called a **tagged union**.

The book's `Entry` (p. 19) is the same pattern: a `name`, a type field `Type t` (a plain enum saying `str` or `num`), and a union holding either a C-style string `char* s` (lesson 8) or an `int i`. In `p->v.s`, the `->` is lesson 10's, and the `.` then reaches into the union.

> ⚠️ Nothing checks that `kind` and `v` agree. Store `v.minutes` but leave `kind` saying `stops`, and `show` reads `v.stops`: the bytes of a `double` read as an `int`. That's undefined behaviour (lesson 2), with no error and no warning. That's why the book advises against "naked" unions, meaning unions used on their own, with nothing to keep the type field in step. Put the union and its type field inside a class whose member functions always update both together.

## `std::variant`: the tagged union, done for you

C++17, which is newer than the book, added exactly that wrapper to the standard library: `std::variant`, in `<variant>`. A `std::variant<int, double>` holds either an `int` or a `double`, and it remembers which:

```cpp
#include <iostream>
#include <string>
#include <variant>

struct Countdown {
    std::string line;
    std::variant<int, double> wait;   // stops away (int) or minutes (double)
};

void show(const Countdown& c) {
    std::cout << c.line << ": ";
    if (std::holds_alternative<int>(c.wait)) {
        std::cout << std::get<int>(c.wait) << " stops away\n";
    } else {
        std::cout << std::get<double>(c.wait) << " min\n";
    }
}

int main() {
    Countdown next {"Line 1", 3};   // holds an int
    show(next);                     // Line 1: 3 stops away
    next.wait = 2.5;                // now it holds a double
    show(next);                     // Line 1: 2.5 min
}
```

- Assigning a value switches the variant to that value's type. There's no type field to forget.
- Each type in the list (`int`, `double`) is called an *alternative*. `std::holds_alternative<int>(v)` asks: does `v` hold an `int` right now?
- `std::get<int>(v)` gets the `int` out. Ask for the type it doesn't hold and the program crashes: the terminal shows `bad_variant_access was thrown in -fno-exceptions mode`, then 💥 Program aborted. So check first.
- `std::get_if<double>(&v)` checks and gets in one go: it returns a pointer to the `double`, or `nullptr` if `v` holds something else (lesson 8).

For example, at the end of `main` above, once `next.wait` holds 2.5:

```cpp
const double* m {std::get_if<double>(&next.wait)};
if (m != nullptr) {
    std::cout << *m << " min\n";   // 2.5 min
}
```

A variant can also hold a `std::string`, which a plain union can't do safely. Whenever you're tempted to write a union, use `std::variant`.

## Exercise: Door cycle

A subway door goes through four states: closed, opening, open, closing, then closed again. Make the program print:

```expected
closed
opening
open
closing
closed
opening
```

The enum and `main` are written. Finish the two functions, then try one line:

1. `name`: add a `case` for each of the other three states.
2. `operator++`: write a `switch` that moves `d` on to the next state. After `closing` comes `closed`.
3. Try the `door++;` line at the end of `main`: uncomment it, tap **Run**, read the error, then comment it out again.

The starter runs and prints `closed` six times, with a warning: `enumeration values 'opening', 'open', and 'closing' not handled in switch`. That's `-Wswitch` listing the cases you still have to write. Once all four are there, the warning goes away. Keep the `return "?";`: like the one in `name(Signal)`, it covers a `Door` holding a number with no name.

```cpp starter
#include <iostream>
#include <string>

enum class Door { closed, opening, open, closing };

std::string name(Door d) {
    switch (d) {
    case Door::closed: return "closed";
    // TODO 1: a case for opening, open and closing
    }
    return "?";   // any Door without a case above
}

Door& operator++(Door& d) {
    // TODO 2: a switch that moves d to the next state
    return d;
}

int main() {
    Door door {Door::closed};
    std::cout << name(door) << '\n';
    for (int i = 0; i < 5; ++i) {
        ++door;
        std::cout << name(door) << '\n';
    }
    // door++;   // Try: only ++door is defined
}
```

```cpp solution
#include <iostream>
#include <string>

enum class Door { closed, opening, open, closing };

std::string name(Door d) {
    switch (d) {
    case Door::closed:  return "closed";
    case Door::opening: return "opening";
    case Door::open:    return "open";
    case Door::closing: return "closing";
    }
    return "?";   // any Door without a case above
}

Door& operator++(Door& d) {   // ++d: the next state; after closing comes closed
    switch (d) {
    case Door::closed:  d = Door::opening; break;
    case Door::opening: d = Door::open;    break;
    case Door::open:    d = Door::closing; break;
    case Door::closing: d = Door::closed;  break;
    }
    return d;
}

int main() {
    Door door {Door::closed};
    std::cout << name(door) << '\n';
    for (int i = 0; i < 5; ++i) {
        ++door;
        std::cout << name(door) << '\n';
    }
    // door++;   // Try: only ++door is defined
}
```

Once it passes, try one more thing: add `stuck` to the end of the enum and tap **Run**. Clang points at both switches with `enumeration value 'stuck' not handled in switch`. That's why neither switch has a `default:`. Then take `stuck` out again.

That completes the book's chapter 2. Chapter 3 (p. 23) is about splitting a program into separate parts.
