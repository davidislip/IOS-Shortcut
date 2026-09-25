---
id: 1
title: Hello, subway
concept: program structure, std::cout, compiling
minutes: 8
---
# Hello, subway 🚇

Every C++ program starts running at a function called `main`. Here is the smallest useful one:

```cpp
#include <iostream>

int main() {
    std::cout << "Hello from the subway!\n";
}
```

Line by line:

- `#include <iostream>` pulls in the part of the standard library that does console input/output.
- `int main()` is the entry point. It returns an `int` exit code; if you fall off the end of `main`, it returns `0` ("success") automatically.
- `std::cout` is the standard output stream. `<<` pushes things into it. `std::` means "from the standard library namespace".
- `"\n"` is a newline. Every statement ends with `;`.

## What "Run" actually does

When you tap **▶ Run**, the terminal shows something like:

```
$ clang++ -std=c++23 -O1 -Wall -Wextra main.cpp -o main
$ ./main
```

That's a real compiler (Clang) turning your text into a program, then running it, entirely on this iPad. No internet needed.

> 💡 You can type commands in the terminal too: try `help`, `cat main.cpp`, or `run`.

## Chaining output

`<<` can be chained, and it understands numbers as well as text:

```cpp
#include <iostream>

int main() {
    std::cout << "Stops until home: " << 7 << '\n';
    std::cout << "2 + 3 = " << 2 + 3 << '\n';
}
```

`'\n'` (single quotes) is a single *character*; `"\n"` (double quotes) is a *string*. Both print a newline.

## Exercise

Make the program print exactly these three lines:

```expected
Hello from the subway!
Next stop: C++
3 stops = 6 minutes
```

For the last line, let the program compute `3 * 2` instead of typing `6`.

```cpp starter
#include <iostream>

int main() {
    std::cout << "Hello from the subway!\n";
    // TODO: print "Next stop: C++"
    // TODO: print "3 stops = 6 minutes", computing 3 * 2
}
```

```cpp solution
#include <iostream>

int main() {
    std::cout << "Hello from the subway!\n";
    std::cout << "Next stop: C++\n";
    std::cout << "3 stops = " << 3 * 2 << " minutes\n";
}
```

When your output matches, the terminal turns green ✔ and the lesson is marked done. Try breaking things on purpose too: delete a `;` and read the error. Tap the `main.cpp:5:…` part of an error to jump straight to that line.
