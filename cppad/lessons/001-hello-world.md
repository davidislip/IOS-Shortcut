---
id: 1
title: Hello, World!
concept: compiling and linking, main, comments, std::cout and <<, string literals, escape sequences, exit status
minutes: 12
source: A Tour of C++
source_pages: 1-3
---
# Hello, World!

This lesson covers sections 1.1–1.3 of the book, up to its first function example (lesson 2 starts there): how the text you type becomes a running program, and your first output.

## From source code to program

C++ is a *compiled* language: the whole program is translated into *machine code* (the instructions a processor runs) before it runs. That makes it fast, and lets the compiler catch many mistakes early. You write **source code**: plain text saved in a *source file*, such as `main.cpp`. Two tools then turn it into something the machine can run:

- the **compiler** translates each source file into machine code, stored in an *object file*;
- the **linker** joins the object files (plus the ready-made library code they use) into one **executable**: the program itself.

```text
file1.cpp --compile--> file1.o --+
                                 +--link--> program
file2.cpp --compile--> file2.o --+
(source)              (object)            (executable)
```

Larger programs are split over many source files. Yours have one, `main.cpp`, and `clang++`, the compiler on this iPad, does both steps in one command. Tap **▶ Run** and the terminal shows that one command, then runs the result:

```text
$ clang++ -std=c++23 -O1 -Wall -Wextra main.cpp -o main
✓ built in 1.4 s
$ ./main
Hello, World!
[exit 0 · 3 ms]
```

`-o main` names the executable `main`; the other flags pick the C++23 edition of the language, extra *warnings* and a little more speed. A warning flags code that compiles but is probably a mistake; an *error* stops the build. `./main` runs the result. The last line is explained at the end.

An executable only runs on the kind of computer it was built for: a program built for a Windows laptop won't even start on an iPad. (Here `clang++` builds for WebAssembly, a "virtual computer" inside the browser, so your programs run in this app.) What travels is the source code: the same `main.cpp` compiles everywhere. That's what *portable* means for C++.

## What "C++" is

C++ is defined by an international *ISO standard*, revised every three years (C++11, 14, 17, 20, 23). It describes two things:

- the *core language*: built-in types such as whole numbers (`int`) and characters (`char`), loops (code that repeats), and the rules for writing them;
- the *standard library*: ready-made tools that every C++ setup provides, such as `std::cout` for output.

C++ is also *statically typed*: the compiler knows the type of every name and value (whole number, text…) and rejects operations that make no sense for it, such as multiplying two pieces of text. Lesson 3 covers types properly.

> 💡 Each code example has an **Open in editor** button. Examples with `main` run; a snippet without `main` is only a fragment and won't build. Run also compares the output with the exercise's expected output (the **Check ✓** button does the same; lesson 9 shows when you need it), so on an example it says ✗ Not quite. That's fine. **Reset** brings the exercise starter back.

## The smallest program

```cpp
int main() { }   // a complete program that does nothing
```

`main` is a **function**: a named piece of code (lesson 2 shows how to write your own). Its `()` is empty, so it needs no inputs. Its `{ }` is empty too, so it does nothing. The `int` in front says what `main` hands back when it finishes: an `int`, which is a whole number. The end of this lesson shows what that number is for.

- A **statement** is one instruction, such as "print this"; most end with `;`. `{ }` bundle several statements into one unit. Around `main` they hold its *body*: the statements that run when `main` runs.
- `//` turns the rest of its line into a **comment**: a note for whoever reads the code. The compiler skips it entirely.
- Every program has exactly one `main`. The program starts at `main`'s first statement and ends when `main` finishes.

## Your first output

A program that does nothing isn't much use. This one prints a greeting:

```cpp
#include <iostream>

int main() {
    std::cout << "Hello, World!\n";
}
```

Line by line:

- `#include <iostream>` pulls in `iostream`, the standard library's input/output **header**. It introduces names such as `std::cout` to the compiler; such introductions are *declarations*. Leave the line out and you get `error: use of undeclared identifier 'std'` (an *identifier* is a name; *undeclared* means the compiler hasn't been told what it is).
- `std::cout` is the **standard output stream**: whatever you send to it appears in the terminal.
- `<<` is read "put to": it sends the value on its right into the stream on its left.
- `"Hello, World!\n"` is a **string literal**: text typed straight into the code, with a double quote at each end.
- `\n` is the *newline* character: it ends the line.
- `;` ends the statement.

> 💡 The book puts `main`'s opening `{` on a line of its own. Both styles mean the same: C++ ignores extra spaces and line breaks, except inside quotes, at the end of a `//` comment, and in `#include` lines, which need a line of their own.

## Chaining `<<`

One statement can send several things in a row, each with its own `<<`. Each `<<` hands `std::cout` on to the next one, so the values go out left to right:

```cpp
#include <iostream>

int main() {
    std::cout << "Platform " << 2 << "\n";
    std::cout << "Mind the ";
    std::cout << "gap\n";
}
```

```text
Platform 2
Mind the gap
```

Three things to notice:

- `2` without quotes is an *integer literal*: a number, not text. `<<` prints numbers too. Here it looks the same as `"2"`, but from lesson 3 on you'll calculate with numbers, and text can't do that.
- `<<` adds no spaces of its own. The space after `Platform` is inside the quotes; leave it out and you get `Platform2`.
- Output moves to a new line only where there's a `\n`. The second and third statements build one line together.

## Escape sequences

Inside quotes, a backslash `\` is a signal: the character right after it isn't printed as itself, it means something else. The backslash and that character together are an **escape sequence**. Here are the three you'll use most:

| Write | To get |
| --- | --- |
| `\n` | a newline |
| `\"` | a double quote, without ending the string |
| `\\` | one backslash |

```cpp
#include <iostream>

int main() {
    std::cout << "Announcer: \"Mind the gap\"\n";
    std::cout << "Made it! \\o/\n";
}
```

```text
Announcer: "Mind the gap"
Made it! \o/
```

> ⚠️ A plain `"` inside a string ends it. In `"Next train: "Line 1" to Finch\n"` the string ends just before `Line`. The compiler reports three errors at that spot, from the strange-looking `invalid suffix on literal` to `use of undeclared identifier 'Line'`. All three mean one thing: a string ended too early. When messages look strange, look at where they point. Write `\"` for a quote that's part of the text, and `\\` for a real backslash (a lone `\` always starts an escape).

## `std::` and `using namespace std;`

The `std::` in front of `cout` names the **namespace** `cout` lives in: `std`, the standard library's. A namespace is a named group of names. The library keeps its names in `std` so they don't collide with names you choose.

The book usually leaves `std::` out when it talks about the library, and its next example (in lesson 2) has this line near the top:

```cpp
using namespace std;   // lets you write cout instead of std::cout
```

After it, plain `cout` means `std::cout`. You'll see this line often, in the book and online. These lessons keep writing `std::`: you can tell at a glance where a name comes from, and the library's hundreds of names can't clash with your own. (Drop `std::` without that line and the compiler asks: `use of undeclared identifier 'cout'; did you mean 'std::cout'?`)

## `main`'s return value

Back to `[exit 0 · 3 ms]`. That's the `int` in `int main()`: when `main` ends, the program hands a whole number back to whatever started it, the **exit status**. By convention, `0` means success and any other value means something went wrong. The `3 ms` is how long the program ran.

If `main` doesn't say otherwise, it returns `0`. (That rule is special to `main`.) To return something else, use a `return` statement:

```cpp
#include <iostream>

int main() {
    std::cout << "Signal problem at Bloor\n";
    return 1;   // nonzero: this run failed
}
```

Now the terminal shows `[exit 1 · … ms]`, marked as an error. A program that did its job should report success, so in your exercises leave the `return` out of `main` (or write `return 0;`).

## Exercise: Departure board

Make the program print exactly:

```expected
Hello, World!
Next train: "Line 1" to Finch
Arrives in 3 minutes
```

- Line 2 needs `\"` for its quotes.
- In line 3, print the `3` as a number with a chained `<<`, not inside the string. Mind the spaces on either side of it.
- Replace the TODO comments with code, and add at least one `//` comment of your own that says what a line does.

```cpp starter
#include <iostream>

int main() {
    std::cout << "Hello, World!\n";
    // TODO: print   Next train: "Line 1" to Finch
    // TODO: print   Arrives in 3 minutes   (the 3 as a number)
}
```

Tap **▶ Run**. The first build after opening the app takes a few seconds while the compiler starts. When your output matches, the terminal shows ✔ and the lesson is marked done.

Break things on purpose too: delete the `;` after `"Hello, World!\n"`, run, and read the error. `main.cpp:4:35: error: expected ';' after expression` means file `main.cpp`, line 4, column 35. Tap that part to jump straight to the spot.

Optional: add `return 3;` as the last line of `main`, run, and watch the terminal show `[exit 3 · … ms]`. The output still matches, so the check passes; only the exit line is marked as an error. Then take it out again.

```cpp solution
#include <iostream>

int main() {
    // The departure board: one line per statement
    std::cout << "Hello, World!\n";
    std::cout << "Next train: \"Line 1\" to Finch\n";   // \" prints a quote
    std::cout << "Arrives in " << 3 << " minutes\n";
}
```
