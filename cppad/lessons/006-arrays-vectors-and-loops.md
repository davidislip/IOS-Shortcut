---
id: 6
title: Arrays, vectors and loops
concept: built-in arrays, indexes from 0, constant array bounds, out-of-range indexes, for loop, range-for, running total, std::vector, push_back, size
minutes: 14
source: A Tour of C++
source_pages: 9-10
---
# Arrays, vectors and loops

So far every variable has held one value. But a train has several cars, and a line has many stations. This lesson shows how to keep many values of the same type together, and how to visit them all with a loop.

## Arrays

```cpp
#include <iostream>

int main() {
    constexpr int cars {4};
    int riders[cars] {12, 30, 25, 8};   // one int per car

    std::cout << "first car: " << riders[0] << '\n';        // 12
    std::cout << "last car: " << riders[cars - 1] << '\n';  // 8

    riders[1] = 31;                     // an element is an ordinary int variable
    std::cout << "second car: " << riders[1] << '\n';       // 31
}
```

- An **array** is a fixed number of values of one type, stored side by side. In a declaration, `[ ]` means "array of": `riders[cars]`, with `cars` equal to 4, is an array of 4 ints. The book's `char v[6];` is an array of 6 chars.
- Each value is an **element**. You pick one by its **index** in square brackets: `riders[2]`.
- Indexes start at **0**, so an array of `n` elements runs from `a[0]` to `a[n - 1]`. Think of the index as "how many elements to skip from the start": the first one skips none.

The size must be a **constant expression** (lesson 5), because the compiler fixes the array's size when it builds the program. That's why `cars` is `constexpr`. An array can never grow or shrink.

> 💡 `int n {4}; int a[n];` compiles here, but with the warning "variable length arrays in C++ are a Clang extension". It isn't standard C++: GCC allows it too, but Microsoft's compiler refuses it, so code that uses it isn't portable. Use a `constexpr` size.

### Initializing an array

```cpp
int a[5] {1, 2};        // 1 2 0 0 0: missing elements become 0
int zeros[4] {};        // 0 0 0 0
int stops[] {3, 1, 4};  // no size given: the list has 3 values, so 3 elements
```

A list that's too long is an error ("excess elements in array initializer"). The book writes `int v[] = {0,1,2,…};`: with a list, the `=` is optional (lesson 4). Inside a function, an array with no `{}`, as in `int a[4];`, has uninitialized elements, just like `int count;` in lesson 4. Always give it a list, even an empty `{}`.

Page 9 also declares `char* p`, a *pointer*. Lesson 8 explains that line and the picture on page 10.

## The `for` loop

Printing each car by hand gets old fast. A `for` loop repeats a block of code:

```cpp
#include <iostream>

int main() {
    constexpr int cars {4};
    int riders[cars] {12, 30, 25, 8};

    for (int i = 0; i < cars; ++i) {
        std::cout << "car " << i << ": " << riders[i] << '\n';
    }
    // car 0: 12
    // car 1: 30
    // car 2: 25
    // car 3: 8
}
```

The parentheses hold three parts, separated by `;`, that do the counting for you:

1. **initializer** `int i = 0`: runs once, before anything else.
2. **condition** `i < cars`: checked before every round. When it's false, the loop ends.
3. **step** `++i`: runs after every round.

So the body runs with `i` = 0, 1, 2, 3. When `i` reaches 4, `4 < 4` is false and the loop stops. That's exactly the valid indexes. `i` is local to the loop (lesson 5): it doesn't exist after the closing `}`.

The book writes `for (auto i=0; i!=10; ++i)`: `auto i = 0` makes `i` an `int` (lesson 4), and "while `i` is not 10" stops at the same point as `i < 10`. These lessons use `<`: if `i` ever skips past the end (say with `i += 3`: 0, 3, 6, 9, 12…), `i != 10` never becomes false, but `i < 10` still stops.

By lesson 4's rule you'd write `for (int i {0}; …)`, and that works. But `=` in a `for` header, as in `int i = 0` or the book's `auto i=0`, is what nearly all C++ code uses, so these lessons use it there too.

> ⚠️ **C++ doesn't check array indexes.** Write `i <= cars` instead of `i < cars` and the last round reads `riders[4]`, which isn't part of the array. Nothing stops the program: it reads whatever memory lies there and prints a junk number (one run printed 858927408). The compiler warns only about a constant index like `riders[4]`. Loop while `i < size`, or use a range-for (next section).

Reading past the end of an array is undefined behaviour (lesson 2): the program might print junk, crash, or seem fine today and break tomorrow.

### Arrays don't copy with `=`

A built-in array comes from C and is very low-level. It can't even copy itself, so you copy it one element at a time:

```cpp
#include <iostream>

int main() {
    constexpr int n {5};
    const int today[n] {4, 2, 3, 3, 5};
    int tomorrow[n] {};              // all 0 for now; the loop fills it in

    // tomorrow = today;             // error: array type 'int[5]' is not assignable
    for (int i = 0; i < n; ++i) {
        tomorrow[i] = today[i];      // copy element i
    }

    tomorrow[0] = 9;                 // the copy is separate: today[0] is still 4
    for (int i = 0; i < n; ++i) {
        std::cout << tomorrow[i] << ' ';
    }
    std::cout << '\n';               // 9 2 3 3 5
}
```

`int tomorrow[n] = today;` fails too. A `std::vector`, at the end of this lesson, copies with `=` just fine.

## Range-for: "for each element"

Often you want to visit every element, in order. The **range-for** does that without an index:

```cpp
#include <iostream>

int main() {
    int stops[] {3, 1, 4, 1, 5};

    for (auto x : stops) {           // for each x in stops
        std::cout << x << ' ';
    }
    std::cout << '\n';               // 3 1 4 1 5

    int total {0};
    for (auto x : stops) {
        total += x;                  // add each element to the running total
    }
    std::cout << total << '\n';      // 14
}
```

Each time round, `x` holds the value of the next element, starting with `stops[0]`; after the last one the loop ends. `auto` gives `x` the type of the elements, `int` here (lesson 4). `for (int x : stops)` means the same. There's no index and no size to get wrong.

`x` is a **copy** of each element, so changing `x` doesn't change the array. Lesson 7 shows how to change the elements themselves.

The first loop is how you print an array. `std::cout << stops;` compiles, but prints something like `0xfff0`, a memory address, not the numbers (lesson 8 explains why).

The second loop keeps a **running total**. Start the total before the loop. Declared inside the body, it would restart at 0 every round.

A range-for also works on a list written right there, without declaring an array first:

```cpp
for (auto minutes : {2, 1, 2, 2}) {
    std::cout << minutes << " min\n";
}
```

Use a range-for when you want every element in order. Use the classic `for` when you need the index itself, for example to walk two arrays side by side.

> 💡 The book leaves out the `{ }` when a loop body is a single statement. That's legal, but these lessons always write them, so adding a second line later can't go wrong.

## `std::vector`: an array that can grow

Arrays can't grow, can't be copied with `=`, and don't know their own size. `std::vector` fixes all three. The book uses `vector` in examples long before it explains it (chapter 9), and its advice on p. 17 is to use the standard `vector` rather than write your own. So here's enough to start with:

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> waits {3, 5, 4};    // a vector of ints with 3 elements
    std::cout << waits[0] << '\n';       // 3: indexes work like an array's
    std::cout << waits.size() << '\n';   // 3

    waits.push_back(6);                  // add 6 at the end: 3 5 4 6
    std::cout << waits.size() << '\n';   // 4

    auto backup = waits;                 // = copies the whole vector
    backup[0] = 10;                      // change only the copy
    std::cout << waits[0] << ' ' << backup[0] << '\n';   // 3 10

    for (auto w : waits) {
        std::cout << w << ' ';
    }
    std::cout << '\n';                   // 3 5 4 6
}
```

- `#include <vector>`, then `std::vector<int>`: the type in `< >` is the element type. `std::vector<double>` and `std::vector<std::string>` work the same way.
- `waits.size()` asks the vector how many elements it has. The dot calls a function that belongs to the vector; lesson 11 shows how to write your own.
- `push_back(x)` adds `x` at the end, and the vector grows.
- Like `std::string` (lesson 4), a vector initializes itself: `std::vector<int> v;` starts empty, ready for `push_back`.

| | built-in array | `std::vector` |
| --- | --- | --- |
| size | fixed, a constant expression | grows with `push_back` |
| how many elements? | you keep track | `v.size()` |
| copy with `=` | no | yes |
| index checked with `[ ]`? | no | no |

Built-in arrays are the low-level building block (a vector also keeps its elements side by side in memory, just like an array), and you'll see them in older code and in the book. For your own lists, reach for `std::vector`. For a list whose size never changes, modern code often uses `std::array`, which comes later in the book.

> 💡 Why only range-for over a vector here? `v.size()` has an unsigned type (lesson 3), so `for (int i = 0; i < v.size(); ++i)` gives the warning "comparison of integers of different signs". A range-for avoids the question.

## Exercise: Arrival times

A northbound train leaves Union. `stations` lists the stops in order. `minutes[i]` is the time from `stations[i]` to `stations[i + 1]`, so 4 segments join 5 stations: that's why `stations` has `segments + 1` elements. `waits` holds how long you waited on the platform for your last three trains: 3, 5 and 4 minutes. Today you waited 6.

1. Print the first station with time 0 (the starter does this).
2. With a classic `for` loop over the segments, add up the minutes and print each following station with its arrival time.
3. Add today's 6-minute wait to the end of `waits` with `push_back`. Total the waits with a range-for, then print the count with `waits.size()` (don't type the 4) and the total.

```expected
Union 0
King 2
Queen 3
Dundas 5
College 7
4 waits, 18 min total
```

The starter runs and prints just `Union 0`, with one warning: `unused variable 'minutes'`. Nothing reads the array yet; your loop will fix that.

```cpp starter
#include <iostream>
#include <string>
#include <vector>

int main() {
    constexpr int segments {4};
    const std::string stations[segments + 1] {"Union", "King", "Queen", "Dundas", "College"};
    const int minutes[segments] {2, 1, 2, 2};   // minutes[i]: stations[i] to stations[i + 1]

    int elapsed {0};
    std::cout << stations[0] << ' ' << elapsed << '\n';

    // TODO: a for loop with i from 0 while i < segments.
    //       Add minutes[i] to elapsed, then print the station
    //       you arrive at (stations[i + 1]) and elapsed.

    std::vector<int> waits {3, 5, 4};   // platform waits before your last 3 trains
    // TODO: add today's wait of 6 at the end of waits.
    // TODO: total the waits with a range-for.
    // TODO: print waits.size() and the total: "<count> waits, <total> min total"
}
```

```cpp solution
#include <iostream>
#include <string>
#include <vector>

int main() {
    constexpr int segments {4};
    const std::string stations[segments + 1] {"Union", "King", "Queen", "Dundas", "College"};
    const int minutes[segments] {2, 1, 2, 2};   // minutes[i]: stations[i] to stations[i + 1]

    int elapsed {0};
    std::cout << stations[0] << ' ' << elapsed << '\n';
    for (int i = 0; i < segments; ++i) {
        elapsed += minutes[i];
        std::cout << stations[i + 1] << ' ' << elapsed << '\n';
    }

    std::vector<int> waits {3, 5, 4};   // platform waits before your last 3 trains
    waits.push_back(6);
    int total {0};
    for (auto w : waits) {
        total += w;
    }
    std::cout << waits.size() << " waits, " << total << " min total\n";
}
```

Once it passes, try extending the line to Wellesley, 2 minutes after College. You only change `segments` and add one value to each list; the loop adapts on its own. (Check will fail after that, since the output has changed.)
