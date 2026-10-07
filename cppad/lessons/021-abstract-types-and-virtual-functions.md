---
id: 21
title: Abstract types and virtual functions
concept: abstract types, virtual functions, pure virtual functions, abstract classes, derived and base classes, inheritance, overriding, override, polymorphic types, virtual destructors, the vtbl
minutes: 15
source: A Tour of C++
source_pages: 39-42
---
# Abstract types and virtual functions

Lessons 18–20 built concrete types: `complex`, `Money`, the book's `Vector`. Their representation is written in the class, so code that uses one knows exactly what an object holds and how big it is. That makes them fast, at the price lesson 18 named: change the representation, and every user must be recompiled.

Section 4.3, halfway down p. 39, goes the other way. An **abstract type** shows its users nothing but an interface: no data members, and no hint of what the real object behind it holds or how big it is. So users reach its objects through references or pointers (lessons 7 and 8), which work for an object of any size. In return, the code behind the interface can change, or be swapped for different code, and the users never notice.

## An interface and nothing else

The book's `Container` (p. 39) is an abstract version of its `Vector`:

```cpp
class Container {
public:
    virtual double& operator[](int) = 0;   // pure virtual function
    virtual int size() const = 0;          // const member function (lesson 18)
    virtual ~Container() {}                // destructor (lesson 19)
};
```

- `virtual` makes a **virtual function**: one that a class built on this one can replace with its own version.
- `= 0` makes it a **pure virtual function**: `Container` has no version at all, so a class built on it must supply one before you can make objects of that class.
- A class with a pure virtual function is an **abstract class**: you can't make an object of one. `Container c;` fails:

```text
error: variable type 'Container' is an abstract class
note: unimplemented pure virtual method 'operator[]' in 'Container'
note: unimplemented pure virtual method 'size' in 'Container'
```

The notes list what's missing. A by-value parameter, `void use(Container c)`, fails too (`parameter type 'Container' is an abstract class`): it would need a copy that is just a Container.

`Container` declares no constructor: an interface has nothing to set up. Its destructor exists for one job. When an object is deleted through a `Container*`, that `delete` must reach the real class's destructor, which knows what the object owns, and `virtual` makes it do so. Lesson 22 shows what happens without it. For now, give every interface an empty virtual destructor, as the book does.

## Classes that implement it

Tap **Open in editor** and **▶ Run**:

```cpp
#include <initializer_list>
#include <iostream>
#include <vector>

class Container {
public:
    virtual double& operator[](int) = 0;
    virtual int size() const = 0;
    virtual ~Container() {}
};

class Vector_container : public Container {   // a Vector_container is a Container
public:
    Vector_container(std::initializer_list<double> lst) : v{lst} { }
    double& operator[](int i) override { return v[i]; }
    int size() const override { return static_cast<int>(v.size()); }
private:
    std::vector<double> v;
};

class Pair_container : public Container {     // exactly two elements, no array
public:
    Pair_container(double a, double b) : first{a}, second{b} { }
    double& operator[](int i) override {
        if (i == 0) {
            return first;
        }
        return second;   // for any other i: no range check, like [ ] on a vector
    }
    int size() const override { return 2; }
private:
    double first;
    double second;
};

void use(Container& c) {                      // knows only the interface
    const int sz {c.size()};
    std::cout << sz << " elements:";
    for (int i = 0; i < sz; ++i) {
        std::cout << ' ' << c[i];
    }
    std::cout << '\n';
}

int main() {
    Vector_container vc {10, 9, 8, 7};
    Pair_container pc {2.5, 7.5};
    use(vc);   // 4 elements: 10 9 8 7
    use(pc);   // 2 elements: 2.5 7.5
}
```

`use()` knows only Container, yet `use(vc)` ran Vector_container's `size()` and `[ ]`, and `use(pc)` ran Pair_container's. That's what `virtual` buys.

- `class Vector_container : public Container` makes `Vector_container` a **derived class** of `Container`, and `Container` its **base class**. Read the `: public` as "is a kind of". A Vector_container gets everything Container declares: it **inherits** those members, and deriving is also called **inheritance**. You'll also hear *subclass* and *superclass*.
- Its `operator[]` and `size()` **override** Container's: they're the versions that run for a Vector_container. Each is virtual too, without saying so again.
- `override`, written after the parameters (and any `const`), before the body, says "this replaces a virtual function of the base". It's optional, and the book only starts writing it in §4.5.1, but put it on every overrider: if the function doesn't really replace anything, Clang says so instead of quietly making a new function (lesson 22).
- The book's Vector_container wraps lesson 19's `Vector`, with an empty `~Vector_container() {}`: after that body, the member's `~Vector()` frees the array. This one wraps a `std::vector<double>`, takes a `{}`-list (lesson 20) and needs no destructor. The one the compiler writes still overrides `~Container()`.

`Pair_container` stands in for the book's `List_container` (p. 41). That one keeps its elements in a `std::list` and has to walk along the list to find element `i`: slow, but as different from a vector as possible, which is the point. Pair_container has no array at all, just two named doubles.

> ⚠️ **Override every pure virtual function.** Forget `size()` in Pair_container, and Pair_container is abstract too. Nothing complains about the class itself: the error appears where you make an object, `variable type 'Pair_container' is an abstract class`, and the note names the function you forgot.

> 💡 Leave out the `public` in `: public Container`, and a class inherits privately: the outside world isn't told that a Vector_container is a Container. `use(vc)` then fails with `cannot cast 'Vector_container' to its private base class 'Container'`. (In a `struct`, inheritance is public unless you say otherwise: the extra difference lesson 11 said inheritance would bring.)

## Code that knows only the interface

`use()` is the book's function (p. 40), printing on one line. A class like `Container`, one interface in front of many implementations, is a **polymorphic type** (Greek for "many forms"). To the compiler, any class with a virtual function is polymorphic, so Vector_container is one too; lesson 23 needs that.

This pays off when building, too (lesson 13). Put `Container` in `Container.h`, and `use()` in `use.cpp`, which includes only that header. Rewrite Vector_container's insides, or write a new kind of Container next year, and `use.cpp` stays exactly as it is: no recompiling, just linking again.

Some code must still name a concrete class to create the object, like `main` here; the book usually puts such objects on the free store, which lesson 23 covers.

## How does `c[i]` find the right function?

Section 4.4 (p. 42) looks inside. While compiling `use()`, the compiler can't know which `operator[]` `c[i]` means: it's a different one on each call. So the choice is made at run time (lesson 5). The usual technique:

- Each class with virtual functions gets a table of them, the **virtual function table**, or **vtbl**. Every class derived from Container lists its functions in the same order: entry 0 is its `operator[]`, entry 1 its `size()`, and so on.
- Each object of such a class holds a hidden pointer to its class's table.

```text
 vc                  Vector_container's vtbl
+------------+      +----------------------+
| vtbl:  o---+----> | 0: operator[]        |
| v          |      | 1: size              |
+------------+      | 2: ~Vector_container |
                    +----------------------+
 pc                  Pair_container's vtbl
+------------+      +----------------------+
| vtbl:  o---+----> | 0: operator[]        |
| first:  2.5|      | 1: size              |
| second: 7.5|      | 2: ~Pair_container   |
+------------+      +----------------------+
```

`c[i]` becomes "follow `c`'s hidden pointer, and call entry 0 of that table". That needs neither the object's size nor its layout, which is exactly why `use()` works for classes written after it. The cost is small: the book puts a virtual call within 25% of an ordinary one, and the space is one pointer per object plus one table per class.

You can see that pointer with `sizeof` (lesson 3):

```cpp
#include <iostream>

struct Plain {
    int x {0};
    int get() const { return x; }
};

struct With_virtual {
    int x {0};
    virtual int get() const { return x; }
};

class Container {
public:
    virtual double& operator[](int) = 0;
    virtual int size() const = 0;
    virtual ~Container() {}
};

int main() {
    std::cout << sizeof(Plain) << '\n';          // 4
    std::cout << sizeof(With_virtual) << '\n';   // 8
    std::cout << sizeof(Container) << '\n';      // 4
}
```

`Plain` is just its `int`: member functions take no room in an object. Make `get()` virtual and the object grows to 8 bytes: the `int` plus the hidden pointer, which is 4 bytes on this iPad. `Container` has no data members at all, yet it takes 4 bytes: that's the pointer. It's only the interface part; the real object behind a `Container&` adds its own data.

## Exercise: Fare rules

Lesson 14 kept the Metro and bus fares apart with namespaces, and `main` had to name each one. Here the same two rules, plus a senior fare, sit behind one interface. `Fare_rule` says what a ride costs for a number of zones, in cents, and what the rule is called. Write three rules, each derived from `Fare_rule`, and one function that works with any of them:

1. `Adult`: 325 for one zone, plus 50 for each zone after the first.
2. `Senior`: half the adult fare, dropping any half cent (integer division, lesson 3). Rather than copying Adult's formula, you can ask an Adult: `Adult{}.price(zones)` makes a temporary Adult, like lesson 18's `Money{}`.
3. `Flat`: the same price for any number of zones. Write the whole class: a constructor `Flat(int fare)` stores the price in a private `int cents`.
4. `void print_table(const Fare_rule& r)`: the rule's name and a colon, then its prices for 1, 2 and 3 zones, each after a space.

Start each overrider from Fare_rule's line: drop `virtual` and `= 0`, put `override` after the `const` and add a body, `int price(int zones) const override { … }`.

```expected
Adult: 325 375 425
Senior: 162 187 212
Flat: 300 300 300
```

The starter won't compile yet: `variable type 'Adult' is an abstract class`, with notes naming `price` and `name`, the two functions Adult still lacks. Senior gets the same, and Flat is an `unknown type name` until you write it. (The warning `unused parameter 'r'` goes once `print_table` uses `r`.) Two more messages you may meet:

- `non-virtual member function marked 'override' hides virtual member function`, with the note `different qualifiers ('const' vs unqualified)`: you left out a `const`, so your function doesn't match Fare_rule's, and the abstract-class errors stay until it does.
- `unused parameter 'zones'` in Flat, whose price ignores the zones: leave the name out, `int price(int) const override`. Like a declaration (lesson 2), a definition may leave a parameter unnamed, which says it isn't used.

```cpp starter
#include <iostream>
#include <string>

class Fare_rule {
public:
    virtual int price(int zones) const = 0;    // fare in cents
    virtual std::string name() const = 0;
    virtual ~Fare_rule() {}
};

class Adult : public Fare_rule {
public:
    // TODO 1: price: 325 for one zone, plus 50 for each zone after it
    //         name: "Adult"
};

class Senior : public Fare_rule {
public:
    // TODO 2: price: half the adult fare
    //         name: "Senior"
};

// TODO 3: class Flat, derived from Fare_rule
//         - constructor Flat(int fare): the private int cents gets fare
//         - price: cents, whatever the zones
//         - name: "Flat"

void print_table(const Fare_rule& r) {
    // TODO 4: print "<name>: <price for 1> <price for 2> <price for 3>"
}

int main() {
    Adult adult;
    Senior senior;
    Flat flat {300};
    print_table(adult);
    print_table(senior);
    print_table(flat);
    // Fare_rule rule;    // Try: Fare_rule is only an interface
}
```

```cpp solution
#include <iostream>
#include <string>

class Fare_rule {
public:
    virtual int price(int zones) const = 0;    // fare in cents
    virtual std::string name() const = 0;
    virtual ~Fare_rule() {}
};

class Adult : public Fare_rule {
public:
    int price(int zones) const override { return 325 + 50 * (zones - 1); }
    std::string name() const override { return "Adult"; }
};

class Senior : public Fare_rule {
public:
    int price(int zones) const override { return Adult{}.price(zones) / 2; }
    std::string name() const override { return "Senior"; }
};

class Flat : public Fare_rule {
public:
    Flat(int fare) : cents{fare} { }
    int price(int) const override { return cents; }    // any number of zones
    std::string name() const override { return "Flat"; }
private:
    int cents;
};

void print_table(const Fare_rule& r) {
    std::cout << r.name() << ':';
    for (int zones = 1; zones <= 3; ++zones) {
        std::cout << ' ' << r.price(zones);
    }
    std::cout << '\n';
}

int main() {
    Adult adult;
    Senior senior;
    Flat flat {300};
    print_table(adult);
    print_table(senior);
    print_table(flat);
    // Fare_rule rule;    // Try: Fare_rule is only an interface
}
```

`print_table` was written once, for the interface, and prints all three rules. A fourth rule, a student fare, say, would need a new class but not a single change to `print_table`.

Once it passes, uncomment the **Try** line and tap **▶ Run**: `variable type 'Fare_rule' is an abstract class`, with a note for each pure virtual function. Put the `//` back.
