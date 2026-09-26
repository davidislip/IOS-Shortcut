---
id: 8
title: Pointers and std::unique_ptr
concept: addresses, *, &, nullptr, heap allocation, std::unique_ptr
minutes: 14
---
# Pointers and `std::unique_ptr`

Every variable lives somewhere in memory. A **pointer** stores that location (an *address*).

```cpp
#include <iostream>

int main() {
    int stops = 5;
    int* p = &stops;     // &stops: "address of stops"; int*: "pointer to int"

    std::cout << *p << '\n';   // *p: "the thing p points at" -> 5
    *p = 6;                    // changes stops through the pointer
    std::cout << stops << '\n';  // 6
}
```

- `&x` gets an address. `*p` *dereferences*, following the pointer.
- `nullptr` means "points at nothing". Dereferencing it is undefined behaviour, so check first: `if (p) { ... }`.
- References (`int&`, from lesson 4) are like pointers that can't be null and can't be re-pointed. Prefer references when you can.

## The heap and ownership

Local variables live on the *stack* and vanish at the end of their scope. Sometimes you need an object whose lifetime you control, or whose size you only know at runtime. That's the *heap*.

Old-style C++ used `new` and `delete`, and forgetting `delete` leaked memory. Modern C++ uses **smart pointers** that apply RAII (lesson 7) to heap memory:

```cpp
#include <iostream>
#include <memory>
#include <string>

struct Car {
    std::string id;
    explicit Car(std::string i) : id{std::move(i)} { std::cout << "build " << id << '\n'; }
    ~Car() { std::cout << "scrap " << id << '\n'; }
};

int main() {
    auto c = std::make_unique<Car>("T1");   // heap object, owned by c
    std::cout << "car " << c->id << '\n';   // -> is (*c).id
}                                          // c's destructor deletes the Car
```

## One owner at a time

A `std::unique_ptr` can't be copied, only **moved**. Moving transfers ownership and leaves the source empty (`nullptr`):

```cpp
auto a = std::make_unique<Car>("T2");
// auto b = a;             // error: copying a unique_ptr is not allowed
auto b = std::move(a);     // ok: b owns it now; a is nullptr
if (!a) std::cout << "a is empty\n";
```

This makes ownership visible in the code: whoever holds the `unique_ptr` is responsible for the object.

## Exercise

Complete the program:

1. Create `first` with `std::make_unique<Car>("T1")`.
2. Move it into a `std::vector<std::unique_ptr<Car>> depot` with `push_back(std::move(first))`.
3. Print whether `first` is now empty.
4. Add a second car `"T2"` directly: `depot.push_back(std::make_unique<Car>("T2"));`
5. Print each car's id from the depot.

```expected
build T1
first is empty: 1
build T2
in depot: T1
in depot: T2
end of main
scrap T2
scrap T1
```

Notice who prints `scrap`, and when: nobody calls `delete`, yet every car is cleaned up exactly once, when `depot` is destroyed at the end of `main`. (This standard library happens to destroy vector elements back to front; the C++ standard doesn't promise an order, so never rely on it.)

```cpp starter
#include <iostream>
#include <memory>
#include <string>
#include <vector>

struct Car {
    std::string id;
    explicit Car(std::string i) : id{std::move(i)} { std::cout << "build " << id << '\n'; }
    ~Car() { std::cout << "scrap " << id << '\n'; }
};

int main() {
    std::vector<std::unique_ptr<Car>> depot;

    // TODO 1-5

    std::cout << "end of main\n";
}
```

```cpp solution
#include <iostream>
#include <memory>
#include <string>
#include <vector>

struct Car {
    std::string id;
    explicit Car(std::string i) : id{std::move(i)} { std::cout << "build " << id << '\n'; }
    ~Car() { std::cout << "scrap " << id << '\n'; }
};

int main() {
    std::vector<std::unique_ptr<Car>> depot;

    auto first = std::make_unique<Car>("T1");
    depot.push_back(std::move(first));
    std::cout << "first is empty: " << (first == nullptr) << '\n';
    depot.push_back(std::make_unique<Car>("T2"));
    for (const auto& car : depot) {
        std::cout << "in depot: " << car->id << '\n';
    }

    std::cout << "end of main\n";
}
```
