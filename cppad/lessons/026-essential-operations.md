---
id: 26
title: The essential operations
concept: the essential operations as a matched set, when objects are copied or moved, operations the compiler generates, = default, declaring one operation suppresses others, pointer and reference members, conversions through one-argument constructors, explicit
minutes: 13
source: A Tour of C++
source_pages: 52-54
---
# The essential operations

Over lessons 19, 24 and 25, the book's `Vector` gained a destructor, two copy operations and two move operations, one at a time. Section 4.6.3 looks at them together, with the constructors.

## A matched set

Here's the whole list, as the book's class `X` (p. 52). `Sometype` stands for whatever an ordinary constructor needs:

```cpp
class X {
public:
    X(Sometype);                  // ordinary constructor: create an object
    X();                          // default constructor
    X(const X&);                  // copy constructor
    X(X&&);                       // move constructor
    X& operator=(const X&);       // copy assignment: clean up the target and copy
    X& operator=(X&&);            // move assignment: clean up the target and move
    ~X();                         // destructor: clean up
};
```

Together, these are the **essential operations**: everything that creates, copies, moves or destroys an object.

Each relies on the others. `Vector`'s move constructor leaves `nullptr` and 0 behind because the destructor still runs on the moved-from object (lesson 25). The copy assignment deletes the old elements because a constructor allocated them. Change how a Vector stores its elements, and every one of them has to change with it.

So the book's rule: if a class's destructor does real work, like `delete[]` or releasing a lock, the class most likely needs the full set, designed together. A destructor on its own gives you lesson 19's `Vector`, which broke as soon as you copied it (lesson 24).

## When objects are copied or moved

There are five situations. Inside some function, with `a` a `Timings` (lesson 24):

```cpp
Timings b = a;     // 1. as an initializer
b = a;             // 2. as the source of an assignment
show(a);           // 3. as an argument, if show takes a Timings by value
return b;          // 4. as a return value
```

The fifth is an exception being thrown (lesson 15), which never happens in this app. Each time, lesson 25's rule decides: a named object that lives on is copied; one that's about to vanish, or wrapped in `std::move`, is moved. And the compiler may skip the step entirely (elision).

Constructors also convert one type to another; that's where this lesson ends.

## What the compiler writes for you

You've relied on the essential operations since lesson 10 without writing them. Apart from the ordinary constructor, the compiler **generates** each one you haven't declared, the first time it's needed (mostly: see the next section).

A generated operation works member by member: the copy constructor copies each member, and so on. That's right for lesson 18's `Money`, and wrong for `Vector`, whose `elem` owns its array (lesson 24's shallow copy).

## Declare one, lose others

The compiler generates some operations only if you haven't declared certain others. Tap **Open in editor** and **▶ Run**:

```cpp
#include <iostream>
#include <utility>
#include <vector>

struct Route {
    std::vector<int> minutes;
    // ~Route() { }             // Try: uncomment and Run again
};

int main() {
    Route a {{3, 2, 4}};
    Route b {std::move(a)};     // move a into b
    std::cout << "a: " << a.minutes.size() << ", b: " << b.minutes.size() << '\n';
}
```

It prints `a: 0, b: 3`: `b` took `a`'s three numbers (a moved-from `std::vector` is left empty). Uncomment the destructor, and it prints `a: 3, b: 3`, with no error and no warning. Declaring a destructor switched off the generated move, so `std::move(a)` quietly copied. For a route of 10,000 stops, every "move" now copies 10,000 ints.

The reasoning: a class that needs its own destructor or copy probably owns something, and moving an owning pointer member by member is lesson 24's shallow copy, double delete included. So the compiler doesn't guess: it falls back to copying.

The rules:

| You declare | The compiler no longer generates |
|---|---|
| any constructor | the default constructor |
| a destructor | the move operations: moving copies instead |
| a copy operation | the move operations: moving copies instead |
| a move operation | the other move operation and both copy operations: copying is an error |

To get a generated operation back, or just to say you want it, write **`= default`** in place of a body. The book's example, with two typos fixed (it prints `Public:`, and its second comment means the *move* constructor):

```cpp
class Y {
public:
    Y(Sometype);
    Y(const Y&) = default;    // I really do want the generated copy constructor
    Y(Y&&) = default;         // ...and the generated move constructor
};
```

Lesson 21's `virtual ~Container() {}` is usually written `virtual ~Container() = default;` today: the same empty destructor, saying so outright.

`= default` still counts as declaring. That's the book's warning that asking for some defaults stops others being generated: `Y` declares a copy and a move constructor, so by the last two rows it gets no assignment at all, and `y1 = y2;` won't compile. After the exercise, you'll see the last row in action.

So the safe habit: once you declare any of the five (copy and move operations, destructor), declare all five, with `= default` wherever the generated version is right. Or declare none, which is where lesson 27 ends up.

## Pointer and reference members

The book adds a rule of thumb for classes that hold a pointer or a reference: say outright how they copy and move. The member alone doesn't tell a reader which of two cases it is:

- The class *owns* what it points to and deletes it, like `Vector`'s `elem`. The generated copy is then wrong (lesson 24): write the operations, or forbid copying (lesson 27).
- The class only *refers* to something it must not delete, like a departure board pointing to the station it hangs in. Copying the pointer is right: two boards can share one station. Say so, with a comment on the member (`// not owned: never deleted here`) or by writing all five as `= default`, so nobody wonders whether you forgot.

A reference member is stricter still: a reference never switches to another object (lesson 7), so the compiler won't generate a copy assignment: a board holding a `const Station&` can be copied, but not assigned.

## Constructors that convert

Lesson 18's `Money(int cents)` did two jobs. It built a Money, and it told the compiler how to turn any `int` into one, so `top_up += 50` worked. Every constructor that takes a single argument defines such a **conversion**. For number-like types, like the book's `complex` (`complex z1 = 3.14;` gives {3.14, 0}), that's what you want.

For most types it isn't. The book's `Vector(int s)` makes a Vector of `s` elements, so with `void print(const Vector& v)`:

```cpp
Vector v1 = 7;     // compiles: 7 zeros, not a Vector holding 7
print(12);         // compiles: builds a Vector of 12 zeros just to print it
```

Neither line means what it seems to, and `std::vector` allows neither.

## `explicit`

Mark the constructor **`explicit`**, and it no longer converts by itself. It only runs where you name the type (an explicit conversion, like lesson 20's `static_cast`):

```cpp
class Vector {
public:
    explicit Vector(int s);    // no implicit conversion from int to Vector
    // ...
};

// () not {}: lesson 20's list constructor would make {7} one element
Vector v1(7);        // OK: you named the type
Vector v2 = 7;       // error
print(12);           // error
print(Vector(12));   // OK, if that's really what you meant
```

For `v2`, Clang says `no viable conversion from 'int' to 'Vector'`, with the note `explicit constructor is not a candidate`. This is where lesson 24's *copy initialization* matters: the `=` form, passing an argument and returning a value never convert through an `explicit` constructor, while `v1(7)` and `Vector(12)` name the type, so they may.

The book's advice sets a default: start every one-argument constructor with `explicit`, and leave it off only when the conversion really makes sense. It does for `complex`: 3.14 really is the complex number {3.14, 0}. `Money` is a judgment call: `top_up += 50` is handy, but is that 50 dollars or 50 cents? The exercise's `Platform` and `Minutes` are a clear no: they exist so that a plain `int` can't slip in.

> ⚠️ **Silent conversions hide swapped arguments.** If two parameter types both convert from `int`, a plain `int` fits either one, so passing them in the wrong order still compiles.

## Exercise: Stop silent conversions

The network's announcements go through `announce(Platform p, Minutes m)`. Wrapping each `int` in a class of its own should stop a platform being passed as a wait, but only if the constructors are `explicit`. These aren't, and the Yonge call in `main` has its arguments swapped: it still compiles.

1. Make both constructors `explicit`. Tap **Run**: each call that passes a plain `int` now fails with `no matching function for call to 'announce'`, and the note says `no known conversion from 'int' to 'Platform' for 1st argument`. (Clang reports one argument at a time.)
2. Fix those calls by naming the types: `announce(Platform{1}, Minutes{3})`. When you get to Yonge, writing the types shows the swap. Fix that too. In the last call, `usual` is already a `Minutes`, so only the platform needs its type.

```expected
Train on platform 1 in 3 min
Train on platform 2 in 12 min
Train on platform 4 in 5 min
```

The starter runs, and prints `Train on platform 12 in 2 min` in the middle.

```cpp starter
#include <iostream>

class Platform {
public:
    Platform(int n) : num{n} { }        // TODO 1: explicit
    int number() const { return num; }
private:
    int num;
};

class Minutes {
public:
    Minutes(int m) : mins{m} { }        // TODO 1: explicit
    int count() const { return mins; }
private:
    int mins;
};

void announce(Platform p, Minutes m) {
    std::cout << "Train on platform " << p.number() << " in " << m.count() << " min\n";
}

int main() {
    // TODO 2: once the constructors are explicit, name the types in each call
    announce(1, 3);                            // Bloor

    int yonge_platform {2};
    int yonge_wait {12};
    announce(yonge_wait, yonge_platform);      // Yonge

    Minutes usual {5};
    announce(4, usual);                        // King
}
```

```cpp solution
#include <iostream>

class Platform {
public:
    explicit Platform(int n) : num{n} { }
    int number() const { return num; }
private:
    int num;
};

class Minutes {
public:
    explicit Minutes(int m) : mins{m} { }
    int count() const { return mins; }
private:
    int mins;
};

void announce(Platform p, Minutes m) {
    std::cout << "Train on platform " << p.number() << " in " << m.count() << " min\n";
}

int main() {
    announce(Platform{1}, Minutes{3});                           // Bloor

    int yonge_platform {2};
    int yonge_wait {12};
    announce(Platform{yonge_platform}, Minutes{yonge_wait});     // Yonge

    Minutes usual {5};
    announce(Platform{4}, usual);                                // King
}
```

Once it passes, see the table's last row for yourself. Add `Minutes(Minutes&&) = default;` under the `Minutes` constructor and tap **Run**. Passing `usual` by value needs a copy, and the King call fails: `call to implicitly-deleted copy constructor of 'Minutes'`, with the note `copy constructor is implicitly deleted because 'Minutes' has a user-declared move constructor`. ("Deleted" is C++'s word for an operation that can't be used.) Add `Minutes(const Minutes&) = default;` as well, and it compiles again. Then take both lines out.

Lesson 27 deletes operations on purpose, and comes back to the choice from *Declare one, lose others*: all five, or none.
