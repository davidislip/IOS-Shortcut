---
id: 5
title: std::vector and algorithms
concept: std::vector, push_back, size, std::ranges::sort, lambdas
minutes: 12
---
# `std::vector` and algorithms

`std::vector<T>` is C++'s go-to container: a growable array of `T`s stored contiguously in memory.

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> delays{4, 0, 12, 3};   // minutes late per train
    delays.push_back(7);                    // add to the end

    std::cout << "trains: " << delays.size() << '\n';
    std::cout << "first: " << delays[0] << ", last: " << delays.back() << '\n';

    int total = 0;
    for (int d : delays) total += d;
    std::cout << "total delay: " << total << '\n';
}
```

- `v[i]` is unchecked: reading past the end is *undefined behaviour* (anything can happen).
- `v.at(i)` checks the index and stops the program if it's out of range. Try it: the terminal will show a crash message.

## Let the library do the loops

`<algorithm>` has well-tested building blocks. The C++20 *ranges* versions take the whole container:

```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{5, 2, 9, 1, 7};

    std::ranges::sort(v);                               // 1 2 5 7 9
    auto biggest = std::ranges::max(v);                 // 9
    bool any_zero = std::ranges::contains(v, 0);        // false (C++23)
    auto evens = std::ranges::count_if(v, [](int x) { return x % 2 == 0; });

    for (int x : v) std::cout << x << ' ';
    std::cout << "\nmax=" << biggest << " zero?=" << any_zero << " evens=" << evens << '\n';
}
```

## Lambdas

`[](int x) { return x % 2 == 0; }` is a **lambda**: a small unnamed function you write inline. The `[]` part can *capture* local variables:

```cpp
int limit = 5;
auto late = std::ranges::count_if(v, [limit](int d) { return d > limit; });
```

Sort in a custom order by passing a comparison:

```cpp
std::ranges::sort(v, [](int a, int b) { return a > b; });   // descending
```

## Exercise

Given the delays below:

1. Print them sorted from **largest to smallest**.
2. Print how many trains were more than 5 minutes late (use `count_if` with a captured `limit`).
3. Print the average delay as a `double`.

```expected
sorted: 12 9 7 4 3 0
late (> 5 min): 3
average: 5.83333
```

```cpp starter
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> delays{4, 0, 12, 3, 7, 9};
    const int limit = 5;

    // TODO 1: sort descending, then print "sorted: " followed by the values

    // TODO 2: count delays greater than limit

    // TODO 3: average as a double
}
```

```cpp solution
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> delays{4, 0, 12, 3, 7, 9};
    const int limit = 5;

    std::ranges::sort(delays, [](int a, int b) { return a > b; });
    std::cout << "sorted:";
    for (int d : delays) std::cout << ' ' << d;
    std::cout << '\n';

    auto late = std::ranges::count_if(delays, [limit](int d) { return d > limit; });
    std::cout << "late (> 5 min): " << late << '\n';

    int total = 0;
    for (int d : delays) total += d;
    std::cout << "average: " << static_cast<double>(total) / delays.size() << '\n';
}
```

`static_cast<double>(total)` converts explicitly, so the division happens in floating point.
