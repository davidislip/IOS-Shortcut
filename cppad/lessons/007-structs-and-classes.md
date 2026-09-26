---
id: 7
title: Structs, classes and RAII
concept: struct, class, member functions, constructors, destructors
minutes: 14
---
# Structs, classes and RAII

## Bundling data with `struct`

```cpp
#include <iostream>
#include <string>

struct Station {
    std::string name;
    int line = 1;          // default member value
};

int main() {
    Station s{"Union", 1};
    std::cout << s.name << " is on line " << s.line << '\n';
}
```

## Adding behaviour: member functions

```cpp
struct Train {
    int passengers = 0;
    int capacity = 100;

    bool full() const { return passengers >= capacity; }   // const: doesn't modify
    void board(int n) { passengers += n; }
};
```

## `class`: data + rules

A `class` is a `struct` whose members are **private** by default. You keep data private and expose functions that keep it valid. That validity rule is called an *invariant*:

```cpp
class Counter {
public:
    explicit Counter(int start) : value_{start} {}   // constructor with initialiser list
    void increment() { ++value_; }
    int value() const { return value_; }
private:
    int value_;     // nobody outside can set this to garbage
};
```

## Constructors and destructors: RAII

A **constructor** runs when an object is created; a **destructor** (`~Name()`) runs automatically when it goes out of scope. C++ calls this **RAII** (Resource Acquisition Is Initialisation): acquire a resource in the constructor, release it in the destructor, and you can never forget to clean up. It's how `std::vector`, `std::string` and files manage memory and handles.

```cpp
#include <iostream>
#include <string>

struct Announce {
    std::string name;
    explicit Announce(std::string n) : name{std::move(n)} { std::cout << "doors open: " << name << '\n'; }
    ~Announce() { std::cout << "doors close: " << name << '\n'; }
};

int main() {
    Announce a{"car 1"};
    {
        Announce b{"car 2"};
    }                                   // b destroyed here
    std::cout << "between stations\n";
}                                       // a destroyed here
```

Objects are destroyed in **reverse** order of creation.

## Exercise

Complete `class Ticket` so the program prints exactly the expected output.

- The constructor prints `issue <id>`, the destructor prints `void <id>`.
- `ride()` uses one ride if any are left and returns `true`; otherwise returns `false`.
- `rides_left()` returns the remaining rides.

```expected
issue A
issue B
A rides left: 1
A ride ok: 0
void B
end of block
void A
```

(`0` is how `false` prints.)

```cpp starter
#include <iostream>
#include <string>

class Ticket {
public:
    Ticket(std::string id, int rides) : id_{id}, rides_{rides} {
        // TODO: print "issue <id>"
    }
    // TODO: destructor printing "void <id>"

    bool ride() {
        // TODO
        return false;
    }
    int rides_left() const { return rides_; }

private:
    std::string id_;
    int rides_;
};

int main() {
    Ticket a{"A", 2};
    {
        Ticket b{"B", 5};
        a.ride();
        std::cout << "A rides left: " << a.rides_left() << '\n';
        a.ride();
        std::cout << "A ride ok: " << a.ride() << '\n';
    }
    std::cout << "end of block\n";
}
```

```cpp solution
#include <iostream>
#include <string>

class Ticket {
public:
    Ticket(std::string id, int rides) : id_{id}, rides_{rides} {
        std::cout << "issue " << id_ << '\n';
    }
    ~Ticket() { std::cout << "void " << id_ << '\n'; }

    bool ride() {
        if (rides_ == 0) return false;
        --rides_;
        return true;
    }
    int rides_left() const { return rides_; }

private:
    std::string id_;
    int rides_;
};

int main() {
    Ticket a{"A", 2};
    {
        Ticket b{"B", 5};
        a.ride();
        std::cout << "A rides left: " << a.rides_left() << '\n';
        a.ride();
        std::cout << "A ride ok: " << a.ride() << '\n';
    }
    std::cout << "end of block\n";
}
```
