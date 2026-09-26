---
id: 9
title: "Tests: if, switch and input"
concept: std::cin and >>, if/else, else if, bool functions as tests, switch, case, default, break, fall-through, range-for over a string
minutes: 15
source: A Tour of C++
source_pages: 12-14
---
# Tests: if, switch and input

Section 1.9 of the book is called *Tests*: statements that choose what the program does next. You met `if` in lesson 8. This lesson adds `else` and the `switch` statement, and gives the program something worth deciding about: input typed while it runs.

## Reading input: `std::cin` and `>>`

```cpp
#include <iostream>

int main() {
    std::cout << "How many stops? ";
    int stops {0};
    std::cin >> stops;    // wait for a number, then store it in stops
    std::cout << stops << " stops take about " << stops * 2 << " minutes\n";
}
```

- `std::cin` (also from `<iostream>`) is the **standard input stream**: here, whatever you type in the terminal. It's the input partner of `std::cout`. The book comes back to streams in chapter 8.
- `>>` means "get from". It mirrors `<<` ("put to", lesson 1): the arrows point the way the data flows, from `std::cin` into `stops`.
- What `>>` reads depends on the variable you read into:

| Variable type | What `>>` reads |
| --- | --- |
| `char` | one character |
| `int` | a whole number: `12`, `-3` |
| `double` | a number: `2.5`, `7` |
| `std::string` | one word: everything up to the next space or newline |

Before reading, `>>` skips spaces and newlines: spaces typed before `12` don't matter, and a `char` never gets a space. (Reading a `std::string` needs `#include <string>`, as in lesson 4.)

Tap **Open in editor**, then **▶ Run**: the program stops at the `>>` and waits, and the terminal's input line says *type input, press return*. Type `5`, press return, and it prints `5 stops take about 10 minutes`. What you type shows in yellow: it's your input, not part of the program's output.

### Where to declare it, and why `{0}`

`stops` is declared right where it's read, not at the top of `main`. C++ doesn't make you list your variables first: a declaration may sit between any two statements. So introduce each name just before its first use, which keeps its scope small (lesson 5).

Lesson 4's rule (it's also in the book's advice on p. 14) is not to declare a variable until you have a value for it. With input, the value only arrives on the next line, so start with a harmless `{0}`. If there's nothing left to read, `>>` leaves the variable as it was. Try it: tap **Run**, then **EOF** ("end of input") instead of typing a number. `stops` keeps its 0 and the program prints `0 stops take about 0 minutes`. Without the `{0}`, it would print an uninitialized value (lesson 4): garbage.

> 💡 `>>` takes only what its type can hold. Type `yes` for a `char`, and it gets the `y`: the `es` waits for the next `>>`. Type `five` for an `int`, and it stores 0 and `std::cin` gives up: every later `>>` in the program reads nothing. Chapter 8 of the book shows how to detect that.

## `if` … `else`

In lesson 8, `if` ran its statement only when the condition was true. **`else`** says what to do otherwise:

```cpp
#include <iostream>

bool get_off() {
    std::cout << "Is this your stop (y or n)?\n";
    char answer {0};    // 0: no character yet (lesson 8)
    std::cin >> answer;
    return answer == 'y';
}

int main() {
    if (get_off()) {
        std::cout << "Mind the gap.\n";
    } else {
        std::cout << "Enjoy the ride.\n";
    }
}
```

Exactly one of the two blocks runs. Look at the condition: `get_off()` returns a `bool`, so a call to it can *be* the test. With a good name, `if (get_off())` reads almost like English.

`answer == 'y'` already produces a `bool` (lesson 3), so the function returns it directly. The book's `accept()` on p. 12 says the same thing the long way: `if (answer == 'y') return true; return false;`. No `else` is needed there: `return true` leaves the function at once, so `return false` is only reached when the answer isn't `y`.

### `else if`: more than two choices

```cpp
if (riders < 40) {
    std::cout << "Plenty of seats\n";
} else if (riders < 90) {
    std::cout << "Standing room\n";
} else {
    std::cout << "Wait for the next train\n";
}
```

The tests run from top to bottom, and the first true one wins: the rest are skipped. With 30 riders, only `Plenty of seats` prints, even though `30 < 90` is true too. The final `else` catches everything left over.

## `switch`: one value, many constants

When every test compares *the same* value with a different constant, a **`switch`** says it more clearly:

```cpp
#include <iostream>

void line_name(int line) {
    switch (line) {
    case 1:
        std::cout << "Yonge-University\n";
        break;
    case 2:
        std::cout << "Bloor-Danforth\n";
        break;
    case 4:
        std::cout << "Sheppard\n";
        break;
    default:
        std::cout << "no line " << line << '\n';
    }
    std::cout << "--\n";    // every break jumps to here
}

int main() {
    line_name(2);    // Bloor-Danforth, then --
    line_name(3);    // no line 3, then --
}
```

- The switch compares `line` with each `case` label, jumps to the one that matches, and runs the statements from there.
- `break` leaves the switch: the program continues after its closing `}`. A `return` also works, and leaves the whole function.
- `default` runs when no case matches. With no `default`, a value that matches nothing does nothing.
- The last section needs no `break`: the switch ends right after it anyway.
- Case labels must be distinct constants. Two `case 2:` labels are an error ("duplicate case value"), and so is a plain variable ("case value is not a constant expression"). A `constexpr` (lesson 5) is fine.
- The value must have an **integer type**, such as `int` or `char` (a `char` is stored as a small number, its character code), or be an enumeration (lesson 12). Switching on a `double` or a `std::string` doesn't compile: "statement requires expression of integer type".

The book's `accept2()` on p. 13, an improved `accept()`, switches on the `char` answer: `'y'` returns `true`, `'n'` returns `false`, and the `default` prints a message and returns `false`. You'll write one in the exercise.

### Several labels, one action

A case label only marks a place to jump to. Stack two labels together and both lead to the same statements:

```cpp
switch (ch) {
case 'n':    // north
case 'u':    // up
    ++y;
    break;
case 's':    // south
case 'd':    // down
    --y;
    break;
default:
    std::cout << "I freeze!\n";
}
```

From the matching label, the program runs on until it reaches a `break`. That's why the `break`s matter.

> ⚠️ **A missing `break` falls through** into the next case (a **fall-through**):
>
> ```cpp
> case 'n':
>     ++y;       // forgot break...
> case 's':
>     --y;       // ...so an 'n' runs this line too
>     break;
> ```
>
> Now `n` adds 1 and then subtracts 1, and the move vanishes. This app's compiler (clang) doesn't warn you, not even with `-Wall -Wextra`, so end every case (except the last) with `break` or `return`. GCC's `-Wextra` does warn. To get clang's warning, type `clang++ -std=c++23 -Wall -Wextra -Wimplicit-fallthrough main.cpp` in the terminal: "unannotated fall-through between switch labels".
>
> If you ever *want* to fall through, write `[[fallthrough]];` where the `break` would go. It's an **attribute**: a note to the compiler and to readers that the fall-through is on purpose.

## Each character of a string

A range-for (lesson 6) works on a `std::string` too, one `char` at a time:

```cpp
std::string moves {"nne"};
for (char ch : moves) {
    // ch is 'n', then 'n', then 'e'
}
```

`auto ch` works too (lesson 6). Writing `char` just makes the element type visible.

Put the switch above inside that loop, and you have the book's last example, `action()` (pp. 13–14): a tiny command reader for a video game. It reads a word of commands and moves a player one step per letter.

The book's version uses a `Point` type and game functions it doesn't define here, and it repeats forever with `while (true)`. The exercise keeps the idea with two ints, `x` and `y`, and reads a single word, so the program ends. (Lesson 10 shows how to bundle values like these into one new type, a struct, which is what the book's `Point` is.)

> 💡 **Run or Check?** **▶ Run** lets you play: you type the answers yourself, and nothing is checked. **Check ✓** feeds in the sample input below as if you had typed it (the terminal shows `./main < input`) and compares the output. Your input isn't part of the output, so the expected output has only the program's own lines.

## Exercise: Ride the map

1. In `main`, put everything from the `enter moves:` line to the `position:` line inside `if (accept()) { … }`, and add an `else` that prints `Maybe tomorrow.` Run it and answer `y`, then run it again and answer `n`.
2. Rewrite `accept()` with a `switch` on `answer`: `'y'` returns `true`, `'n'` returns `false`, and anything else prints `I'll take that for a no.` and returns `false`.
3. Finish the moves switch. `'n'` or `'u'` adds 1 to `y` (done for you); `'s'` or `'d'` subtracts 1 from `y`; `'e'` or `'r'` adds 1 to `x`; `'w'` or `'l'` subtracts 1 from `x`; anything else prints `I freeze!`

Check answers `y`, then enters the moves `nneexw`:

```stdin
y
nneexw
```

```expected
Ride the subway (y or n)?
enter moves:
I freeze!
position: 1 2
```

`nn` takes `y` to 2, `ee` takes `x` to 2, the letter `x` isn't a move (`I freeze!`), and `w` brings `x` back to 1.

Test with **Check ✓**: in this lesson, **▶ Run** is for playing and doesn't check.

```cpp starter
#include <iostream>
#include <string>

bool accept() {
    std::cout << "Ride the subway (y or n)?\n";
    char answer {0};
    std::cin >> answer;
    // TODO (step 2): replace this line with a switch on answer:
    //   'y': return true    'n': return false
    //   anything else: print "I'll take that for a no." and return false
    return answer == 'y';
}

int main() {
    // TODO (step 1): run the rest of main only if accept() returns true;
    //                otherwise (else) print "Maybe tomorrow."
    std::cout << "enter moves:\n";
    std::string moves;    // starts empty (lesson 4)
    std::cin >> moves;

    int x {0};
    int y {0};
    for (char ch : moves) {
        switch (ch) {
        case 'n':    // north
        case 'u':    // up
            ++y;
            break;
        // TODO (step 3): 's' or 'd': --y    'e' or 'r': ++x    'w' or 'l': --x
        //                default: print "I freeze!"
        }
    }
    std::cout << "position: " << x << ' ' << y << '\n';
}
```

```cpp solution
#include <iostream>
#include <string>

bool accept() {
    std::cout << "Ride the subway (y or n)?\n";
    char answer {0};
    std::cin >> answer;
    switch (answer) {
    case 'y':
        return true;
    case 'n':
        return false;
    default:
        std::cout << "I'll take that for a no.\n";
        return false;
    }
}

int main() {
    if (accept()) {
        std::cout << "enter moves:\n";
        std::string moves;    // starts empty (lesson 4)
        std::cin >> moves;

        int x {0};
        int y {0};
        for (char ch : moves) {
            switch (ch) {
            case 'n':    // north
            case 'u':    // up
                ++y;
                break;
            case 's':    // south
            case 'd':    // down
                --y;
                break;
            case 'e':    // east
            case 'r':    // right
                ++x;
                break;
            case 'w':    // west
            case 'l':    // left
                --x;
                break;
            default:
                std::cout << "I freeze!\n";
            }
        }
        std::cout << "position: " << x << ' ' << y << '\n';
    } else {
        std::cout << "Maybe tomorrow.\n";
    }
}
```

Once Check passes, tap **▶ Run** and play:

- Run it twice: answer `n` the first time and `?` the second. Both end with `Maybe tomorrow.`, and `?` gets the no-message first.
- Answer `yes`. The `char` takes the `y`, and the leftover `es` becomes your moves: `position: 1 -1`.
- Delete the `break` after `++y`, tap **▶ Run**, answer `y` and enter `nneexw` again. Each `n` now falls through into `--y`, so the result is `position: 1 0`. Put the `break` back afterwards: Check fails without it.

Page 14 closes chapter 1 with a list of advice that sums up lessons 1–9: good reading for the next train. Lesson 10 starts chapter 2, where you build your own types.
