---
id: 8
title: Pointers and nullptr
concept: pointers, address-of &, dereferencing *, pointers into arrays, nullptr, if, while, C-style strings, const char*
minutes: 15
source: A Tour of C++
source_pages: 11-12
---
# Pointers and nullptr

A reference (lesson 7) always names an object, and always the same one. Sometimes you need a handle that can step along a row of objects, or that can say "there's nothing here": no next train yet. That's a **pointer**, a variable that holds where an object lives in memory. The book introduces pointers on pp. 9–10 and comes back to them with `nullptr` on pp. 11–12. This lesson covers both, and adds `if` (a decision) and `while` (a simpler loop) on the way.

## Addresses and pointers

Every object sits somewhere in the computer's memory, and every place in memory has a number, its **address**. A pointer stores an address:

```cpp
#include <iostream>

int main() {
    int stops {5};
    int* p {&stops};              // p holds the address of stops

    std::cout << *p << '\n';      // 5: the int that p points to
    *p = 6;                       // change stops through p
    std::cout << stops << '\n';   // 6
}
```

- `int*` is the type "pointer to `int`". In a declaration, `*` means "pointer to", just as `[4]` means "array of 4" (lesson 6) and `&` means "reference to" (lesson 7).
- In an expression, `&stops` means **address of** `stops`.
- In an expression, `*p` means **the object `p` points to** (the book says "contents of"). Getting to that object is called **dereferencing** `p`. You can read `*p` or assign to it, just like `stops`.

An `int*` can only hold the address of an `int`: `double* q {&stops};` doesn't compile.

> 💡 Between two values, `*` still multiplies and `&` is lesson 3's bitwise and. Only in front of a single name do they mean "the object it points to" (`*p`) and "address of" (`&x`).

## Pointing into an array

This is the book's example from p. 9, made runnable:

```cpp
#include <iostream>

int main() {
    char v[6] {'T', 'r', 'a', 'i', 'n', 's'};
    char* p {&v[3]};            // p holds the address of v[3], the 'i'

    std::cout << *p << '\n';    // i
    ++p;                        // move p along to the next element, v[4]
    std::cout << *p << '\n';    // n
}
```

Right after `char* p {&v[3]}`, before the `++p`, memory looks like this (the book's picture on p. 10):

```text
                  p
                  |
                  |
    +---+---+---+---+---+---+
v:  | T | r | a | i | n | s |
    +---+---+---+---+---+---+
      0   1   2   3   4   5
```

After `++p`, the arrow sits over the `n`. An array's elements sit side by side in memory (lesson 6), so `++p` moves `p` by one element, however many bytes that element takes. From `&v[3]`, `p + 2` would point to `v[5]`, two elements further on, without moving `p` itself.

This also answers a question from lesson 6. In most expressions, an array's name turns into a pointer to its first element (programmers say the array *decays*). So `std::cout << stops` prints the address of `stops[0]`, a number like `0xfff0`, not the numbers in the array.

> 💡 If the terminal shows something like `0xfff0` where you expected a value, you printed the pointer itself: add `*` to print the object it points to. (`char` pointers work differently; see below.)

## Pointers and references

| | reference `int& r {stops};` | pointer `int* p {&stops};` |
| --- | --- | --- |
| use the object | `r` | `*p` |
| switch to another object later | no | yes: `p = &other;` (or `++p` inside an array) |
| can refer to no object | no | yes: `nullptr` |

## `nullptr`: no object

When there is nothing to point to, such as no next train yet or the end of a list, the pointer gets the value **`nullptr`**, the *null pointer*, meaning "no object". The same `nullptr` fits any pointer type:

```cpp
double* fare {nullptr};   // points to no double
int* seat {nullptr};      // points to no int
int count {nullptr};      // error: an int can't hold "no object"
```

The last line fails with `cannot initialize a variable of type 'int' with an rvalue of type 'std::nullptr_t'`: `nullptr` is a pointer value, not a number. (`std::nullptr_t` is `nullptr`'s own type; lesson 12 explains *rvalue*.)

The book's first pointer, `char* p;` on p. 9, gets no value at all. Like `int n;` (lesson 4), it holds garbage, here a random address. Give every pointer a value: an address, or `nullptr` if there's nothing to point to yet.

Older code writes `0` or `NULL` instead (`int* p = 0;`); write `nullptr`, which can only mean "no object", while `0` is also an ordinary number.

### Check before you dereference: `if`

`*p` on a null pointer is undefined behaviour (lesson 2). Don't count on a crash to warn you: in tests with this app's compiler, one crashed, and another quietly printed 65520, a meaningless number. So a function that receives a pointer should check it first. That needs a new statement, **`if`**:

```cpp
// inside a function that receives a pointer p and returns an int
if (p == nullptr) {
    return 0;       // no object: stop here and return 0
}
// from here on, p points to something
```

`if (condition) { … }` runs the block only when the condition is true. Otherwise the program skips the block and carries on after its `}`. (Lesson 9 adds `else`, for what to do otherwise.) The book writes `if (p==nullptr) return 0;` without braces. As with loops (lesson 6), that's legal for a single statement, but these lessons always write the braces.

The condition is a `bool`, like the comparisons in lesson 3, or something that converts to one. A pointer or a number counts as `true` unless it's zero (`nullptr` or `0`). So `if (p)` means `if (p != nullptr)`, and `if (!p)` means `if (p == nullptr)`. You'll see the short forms a lot.

## C-style strings

C, the language C++ grew out of, stores text as an array of `char` with a **zero character** at the end, written `'\0'`. C++ string literals still work this way:

```text
"King" is stored as:   | K | i | n | g | \0 |
```

Every char is stored as a small number, its *code*: `'A'` is 65, and the digit `'0'` is 48. `'\0'` is the char whose code is 0, and it marks where the text stops. That's five chars for four letters.

So a **C-style string** is a run of chars ending in a zero. Code passes it around as a pointer to its first char: in most expressions a literal decays, like any array. It's what `auto stop = "Union";` gave you in lesson 4.

The chars of a literal are read-only, so the pointer type is `const char*`, "pointer to `const char`": you may read the chars but not change them. The pointer itself can still move.

```cpp
const char* stop {"Bloor-Yonge"};
std::cout << stop << '\n';       // Bloor-Yonge
std::cout << *stop << '\n';      // B: the first char
std::cout << stop + 6 << '\n';   // Yonge: the text starting 6 chars later
```

That's the `ops:` mystery from lesson 4: `"Stops: " + stops`, with `stops` at 2, is the text starting 2 chars later.

`std::cout` treats `char` pointers specially: it prints the chars up to the zero. Other pointers, such as `int*` or `double*`, print an address. Two consequences:

- The `char v[6]` array from p. 9 has no zero at the end, so it is *not* a C-style string. `std::cout << v` would run on past its end.
- Never print a null `const char*`. `<<` would look for chars at address 0, which is undefined behaviour too; here it happens to print nothing, which hides the bug. That's why the exercise's `main` never prints its null pointer.

## Walking along a C-style string

To visit every char, start at the first one and move the pointer along until it points to the zero:

```cpp
#include <iostream>

// Prints each char of a C-style string, followed by a dot.
void spell(const char* p) {
    if (p == nullptr) {
        return;                   // no string: nothing to print
    }
    for (; *p != 0; ++p) {        // no initializer: p already points to the first char
        std::cout << *p << '.';
    }
    std::cout << '\n';
}

int main() {
    spell("TTC");       // T.T.C.
    spell("King");      // K.i.n.g.
    spell(nullptr);     // prints nothing
}
```

- `*p != 0` asks: is the char `p` points to anything other than the zero at the end? `*p != '\0'` means the same.
- The `for` leaves out its initializer, because `p` arrives already pointing to the first char. Any of the three parts can be left out, but both `;` stay.
- In a `void` function, `return;` with no value leaves the function early.

### `while`

A `for` without an initializer is really just "check a condition, run the body, take a step". C++ has a simpler statement for that, **`while`**:

```cpp
while (*p != 0) {        // while p isn't at the zero...
    std::cout << *p << '.';
    ++p;                 // ...print its char and move on
}
```

`while (condition) { … }` checks the condition and, if it's true, runs the block, then checks again. It stops when the condition is false. The step now lives inside the body: leave out `++p` and `*p` never changes, so the loop never ends. If that happens, tap **■ Stop** (it appears while a program is running) and add the missing `++p`.

A char is a number, so the zero rule from `if` applies here too: `while (*p)` means `while (*p != 0)`.

> ⚠️ **Test what the pointer points to, not the pointer.** The book's two `count_x` functions (pp. 11–12) loop with `p != nullptr` and `while (p)`. Both test the *pointer*, and moving along a string never turns a pointer into `nullptr`. The loop runs past the zero into whatever memory comes next: undefined behaviour. With this app's compiler, the `for` version stopped with a `💥 Program aborted` message, and the `while` version claimed `"Bloor-Yonge"` has 0 o's.
>
> This is a known mistake in the book's first edition. Check the pointer **once**, before the loop (`if (p == nullptr)`), then loop on the char (`while (*p)`). (On p. 12 the book also calls the function `count_if()` once; it means `count_x`.)

> 💡 The book's `count_x` also takes a plain `char*`. Since C++11, a string literal isn't supposed to become a `char*`, because the function could then change its chars. Clang only warns (`ISO C++11 does not allow conversion from string literal to 'char *'`), and some compilers reject it. For text you only read, write `const char*`, as the exercise does.

## When to use a pointer

Modern C++ reaches for raw pointers less often than chapter 1 might suggest:

- To work on the caller's object, use a reference (lesson 7). There's no `*` to forget, and it can't be null.
- For text, use `std::string` (lesson 4). It knows its own length, and there's no zero to lose.
- Use a pointer when "no object" is a real possibility (`nullptr`), or for low-level work such as a container's insides (lesson 10 shows one).

## Exercise: Station sign

The sign at Bloor-Yonge is stored as a C-style string. Count its chars, and its o's, with two functions:

1. `int length(const char* p)` returns the number of chars before the terminating zero.
2. `int count_char(const char* p, char x)` returns how many of its chars equal `x`. That's the book's `count_x`, with the bug fixed.

Both return 0 for `nullptr`. In each one, check the pointer once with `if`, then walk along with a `while` loop until `*p` is the zero.

```expected
length of "Bloor-Yonge": 11
'o' in "Bloor-Yonge": 3
length of nothing: 0
'o' in nothing: 0
```

The starter runs, but both functions just return 0, and the compiler warns `unused parameter 'p'` (and `'x'`). Once your code uses the parameters, the warnings go away.

```cpp starter
#include <iostream>

// Number of chars before the terminating zero (0 for nullptr).
int length(const char* p) {
    // TODO: if p is nullptr, return 0.
    // TODO: otherwise, keep a count in an int that starts at 0.
    //       While *p isn't the zero: add 1 to the count, move p along.
    //       Return the count.
    return 0;
}

// How many chars equal x (0 for nullptr).
int count_char(const char* p, char x) {
    // TODO: same shape as length, but inside the loop use an if
    //       to count a char only when *p == x.
    return 0;
}

int main() {
    const char* stop {"Bloor-Yonge"};
    const char* nothing {nullptr};

    std::cout << "length of \"" << stop << "\": " << length(stop) << '\n';
    std::cout << "'o' in \"" << stop << "\": " << count_char(stop, 'o') << '\n';
    std::cout << "length of nothing: " << length(nothing) << '\n';
    std::cout << "'o' in nothing: " << count_char(nothing, 'o') << '\n';
}
```

```cpp solution
#include <iostream>

// Number of chars before the terminating zero (0 for nullptr).
int length(const char* p) {
    if (p == nullptr) {
        return 0;
    }
    int n {0};
    while (*p != 0) {
        ++n;
        ++p;
    }
    return n;
}

// How many chars equal x (0 for nullptr).
int count_char(const char* p, char x) {
    if (!p) {                // same test as p == nullptr
        return 0;
    }
    int count {0};
    while (*p) {             // same test as *p != 0
        if (*p == x) {
            ++count;
        }
        ++p;
    }
    return count;
}

int main() {
    const char* stop {"Bloor-Yonge"};
    const char* nothing {nullptr};

    std::cout << "length of \"" << stop << "\": " << length(stop) << '\n';
    std::cout << "'o' in \"" << stop << "\": " << count_char(stop, 'o') << '\n';
    std::cout << "length of nothing: " << length(nothing) << '\n';
    std::cout << "'o' in nothing: " << count_char(nothing, 'o') << '\n';
}
```

Once it passes, predict what `length(stop + 6)` returns, then add a line that prints it and see if you were right. (Check fails while the extra line is there.)
