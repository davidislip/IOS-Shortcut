---
id: 18
title: Concrete types and operators
concept: concrete types, representation and recompiling, default constructor, const member functions, this and *this, operator+=, operators as non-member functions, unary minus, == and !=, conversions through a constructor, temporaries, inline functions, rules for operators, std::complex
minutes: 15
source: A Tour of C++
source_pages: 32-36
---
# Concrete types and operators

Chapter 4 (p. 33) is about classes: each one puts an idea from your program, such as a fare or a timetable, into the code itself. The book looks at three kinds:

- concrete classes, which behave like built-in types (lessons 18–20);
- abstract classes, which show their users only an interface (lesson 21);
- classes in class hierarchies, built on one another (lessons 22 and 23).

## Concrete types

Think of what you can do with an `int`: make one as a local variable, put it inside a struct or a vector, give it a value the moment it's created, copy it with `=`. A **concrete type** is a class that lets you do all of that too. `std::string` and `std::vector` are concrete types, and so is lesson 11's `Train`.

What makes it concrete: its representation (lesson 11's private data members) is part of the class definition. The compiler sees `std::string line; int car_count;` inside `class Train`, so it knows a `Train`'s size and can make room for one right inside a function or another object, with no pointer to follow, which is what makes it fast. (A `std::string` of any length has a fixed size too: it's a handle, like lesson 11's Vector, holding little more than a pointer to the free store.) `private` stops other code from *using* the data members, not from depending on them.

The price: give `Train` a new member and every `Train` changes size and layout, which compiled code relies on. So every file that uses `Train` must be recompiled (lesson 13's changed header again). For types that rarely change, it's a fair deal.

## The book's `complex`

The book's example (p. 35) is `complex`, for complex numbers. You don't need the maths: a complex number is a pair of doubles, the *real* and *imaginary* parts, and adding two adds the parts. It has to behave just like `double`, with `+`, `-` and `==`, and be no slower. Here it is, trimmed a little. Tap **Open in editor** and **▶ Run**, and match the output to the comments. Each new piece gets its own section below.

```cpp
#include <iostream>

class complex {
    double re, im;    // representation: private, since a class starts private (lesson 11)
public:
    complex(double r, double i) : re{r}, im{i} { }
    complex(double r) : re{r}, im{0} { }
    complex() : re{0}, im{0} { }

    double real() const { return re; }
    double imag() const { return im; }

    complex& operator+=(complex z) {
        re += z.re;
        im += z.im;
        return *this;
    }
};

complex operator+(complex a, complex b) { return a += b; }
complex operator-(complex a) { return {-a.real(), -a.imag()}; }
bool operator==(complex a, complex b) {
    return a.real() == b.real() && a.imag() == b.imag();
}

void print(const complex& z) {
    std::cout << '(' << z.real() << ',' << z.imag() << ")\n";
}

int main() {
    complex a {2.3};      // the one-double constructor: {2.3, 0}
    complex b {1, 2};
    complex zero;         // the default constructor: {0, 0}
    print(a + b);         // (3.3,2)
    print(-b);            // (-1,-2)
    print(zero);          // (0,0)
    a += 1;               // 1 becomes complex{1}
    print(a);             // (3.3,0)
    if (a != b) {         // there's no operator!= above
        std::cout << "different\n";
    }
}
```

## Several constructors

`complex` has three constructors, overloaded like lesson 2's functions: the arguments pick one. `complex b {1, 2}` uses the two-double one, `complex a {2.3}` the one-double one.

`complex()` takes no arguments: that's the **default constructor**, used when you give no initializer or empty braces. So `complex zero;` and `complex{}` are {0, 0}, never garbage like `int n;` (lesson 4): the book's reason to write one. (Leave it out, and `complex zero;` doesn't compile, like lesson 11's `Train c;`.)

## `this` and `+=`

`+=` changes the object it's called for, so it's a member function, like lesson 11's `operator[]`: `a += b` means `a.operator+=(b)`.

Inside a member function, the keyword **`this`** is a pointer (lesson 8) to the object the function was called for. In `a += b`, `this` points to `a`. Plain `re` is short for `this->re` (lesson 10's `->`), and **`*this`** is the object itself: `a`.

`operator+=` returns `*this` as a `complex&`, a reference to `a` rather than a copy, just as lesson 12's `operator++` returned `s`. That gives `a += b` a value, the updated `a`, as `x += 1` has for an `int`.

The body reads `z.re`, a private member of *another* complex. That's allowed: private means private to the class, not to one object. (The book writes the body as `re+=z.re, im+=z.im;`: a comma runs the expression on its left, then the one on its right.)

## `const` member functions

`double real() const` has `const` after its parameter list. That makes it a **const member function**: it promises not to change the object, the promise lesson 11's tip deferred. Inside it, `this` points to a `const complex`, so the compiler holds it to the promise: `re = 0;` in `real()` fails with `cannot assign to non-static data member within const member function 'real'`.

In return, `real()` works on objects nobody may change: a `const complex`, or `print`'s `const complex&` parameter `z` (lesson 7).

> ⚠️ Leave `const` off `real()`, and `print` stops compiling: `'this' argument to member function 'real' has type 'const complex', but function is not marked const`. The "'this' argument" is the object before the dot, `z`, and it's const. So mark every member function that doesn't change the object `const`: `real()` and `imag()`, but not `+=`, or the book's setter `void real(double d) { re = d; }`.

## Operators outside the class

Inside the class go only the operations that must touch `re` and `im`. `+` needn't: it can be built on `+=`, so it's an ordinary function outside the class, and `a + b` means `operator+(a, b)`:

```cpp
complex operator+(complex a, complex b) { return a += b; }
```

`a` and `b` are passed by value, so they're copies (lesson 2). `a += b` changes the copy, not the caller's variable, and hands it back: the sum. The book adds `-=`, plus `*=` and `/=` defined outside the class as `complex& complex::operator*=(complex z) { … }` (lesson 13), and builds `-`, `*` and `/` on them.

Outside the class, one parameter makes a unary operator (lesson 3), like lesson 12's `++s`: `complex operator-(complex a)` is the minus in `-b`. (A member gets its left operand as `*this`, so member `+=` has one parameter and is still binary.) The `return {-a.real(), -a.imag()};` builds the result with the two-double constructor.

The book writes `==`, then `!=` as `!(a == b)`. Since C++20, write only `==`: the compiler turns `a != b` into `!(a == b)` itself, which is why `main`'s `a != b` compiles.

## Conversions: `a += 1`

A constructor with one parameter also tells the compiler how to *convert*: `complex(double r)` turns a double into a complex. So `a += 1` means `a += complex{1}` (the `int` 1 becomes a `double` first). `complex{1}` is a **temporary**: an object made on the spot, with no name, gone at the end of the statement. The book's `1/a` on p. 36 means `operator/(complex{1}, a)`.

That's one more reason the arithmetic operators live outside the class. There, both sides are ordinary arguments, so either side can be converted: `2 + b` works. With `+` as a member, `2 + b` would mean `2.operator+(b)`, and an `int` has no member functions: `invalid operands to binary expression ('int' and 'complex')`. For number-like types these conversions are what you want; lesson 26 turns them off where they're wrong.

## Inline functions

Functions defined in the class body are inline (lesson 13). The book's reason is speed: a call to `real()` costs more than the one step it does, so the compiler pastes the body in where it's called, and a `complex` stays as fast as two loose doubles. Today the compiler decides that itself for any small function whose body it can see, keyword or not. What `inline` still guarantees is lesson 13's rule: the definition may sit in a header that many files include.

## Rules for operators

- Only C++'s existing operators, with their usual number of operands: there's no unary `/`. Write one and Clang says `overloaded 'operator/' must be a binary operator (has 1 parameter)`.
- At least one operand must be your own type, so `+` on two `int`s stays addition: `overloaded 'operator+' must have at least one parameter of class or enumeration type`.
- Use them as readers expect: `+` should add. Anything surprising deserves a function with a name.

## The library's `complex`

The book's class is a simplified `std::complex`, from `<complex>`:

```cpp
#include <complex>
#include <iostream>

int main() {
    std::complex<double> z {1, 2};
    std::cout << z * z << '\n';                          // (-3,4)
    std::cout << z.real() << ' ' << z.imag() << '\n';    // 1 2
}
```

`<double>` picks the type of the two parts, as in `std::vector<double>` (chapter 5 shows how). Unlike ours, it prints with `<<`; our own types use a `print` function until the book shows how.

## Exercise: Money

Money is a natural concrete type: small, copied freely, added and compared like a number. `Money` keeps whole cents in an `int` called `total` (not `cents`: that's the function's name, and lesson 11 showed a class can't use one name for both). The constructors and `print` are written. Finish it:

1. Mark `cents()` const. Until you do, `print` doesn't compile: its `m` is a `const Money&`.
2. `Money& operator+=(Money m)`, a member: add `m`'s cents to `total`, then return `*this`.
3. `Money operator+(Money a, Money b)`, outside the class, built on `+=`.
4. `bool operator==(Money a, Money b)`, outside the class. It can't read `total` (private), so compare `cents()`.

`main` is written: `top_up += 50` and `two_fares == 650` turn their `int`s into `Money` through `Money(int)`, and `fare != two_fares` needs no `!=` from you.

```expected
fare: $3.25
two fares: $6.50
top-up: $20.50
nothing: $0.00
two fares are 650 cents: yes
fare and two fares differ: yes
```

The starter won't compile yet. The first error is TODO 1's `not marked const`. The others, three `invalid operands to binary expression (…)` and a `no viable overloaded '+='`, mark the operator lines in `main`. The one on the `!=` line goes away with TODO 4's `==`. Fix, run, repeat.

```cpp starter
#include <iostream>
#include <string>

class Money {
public:
    Money() : total{0} { }
    Money(int dollars, int cents) : total{dollars * 100 + cents} { }
    Money(int cents) : total{cents} { }

    int cents() { return total; }    // TODO 1: promise not to change the Money

    // TODO 2: Money& operator+=(Money m): add m's cents to total,
    //         then return *this

private:
    int total;    // the amount, in cents
};

// TODO 3: Money operator+(Money a, Money b), built on +=

// TODO 4: bool operator==(Money a, Money b), comparing cents()

void print(const std::string& label, const Money& m) {
    int c {m.cents()};
    std::cout << label << ": $" << c / 100 << '.';
    if (c % 100 < 10) {
        std::cout << '0';            // $0.05, not $0.5
    }
    std::cout << c % 100 << '\n';
}

int main() {
    const Money fare {3, 25};        // $3.25
    Money two_fares {fare + fare};
    Money top_up {20, 0};
    top_up += 50;                    // 50 cents, through Money(int)
    print("fare", fare);
    print("two fares", two_fares);
    print("top-up", top_up);
    print("nothing", Money{});       // a temporary: the default constructor
    if (two_fares == 650) {
        std::cout << "two fares are 650 cents: yes\n";
    }
    if (fare != two_fares) {         // you won't write !=
        std::cout << "fare and two fares differ: yes\n";
    }
    // fare += 25;                   // Try: fare is const
}
```

```cpp solution
#include <iostream>
#include <string>

class Money {
public:
    Money() : total{0} { }
    Money(int dollars, int cents) : total{dollars * 100 + cents} { }
    Money(int cents) : total{cents} { }

    int cents() const { return total; }

    Money& operator+=(Money m) {
        total += m.total;            // m's private total: same class, allowed
        return *this;
    }

private:
    int total;    // the amount, in cents
};

Money operator+(Money a, Money b) { return a += b; }   // a is a copy

bool operator==(Money a, Money b) { return a.cents() == b.cents(); }

void print(const std::string& label, const Money& m) {
    int c {m.cents()};
    std::cout << label << ": $" << c / 100 << '.';
    if (c % 100 < 10) {
        std::cout << '0';            // $0.05, not $0.5
    }
    std::cout << c % 100 << '\n';
}

int main() {
    const Money fare {3, 25};        // $3.25
    Money two_fares {fare + fare};
    Money top_up {20, 0};
    top_up += 50;                    // 50 cents, through Money(int)
    print("fare", fare);
    print("two fares", two_fares);
    print("top-up", top_up);
    print("nothing", Money{});       // a temporary: the default constructor
    if (two_fares == 650) {
        std::cout << "two fares are 650 cents: yes\n";
    }
    if (fare != two_fares) {         // you won't write !=
        std::cout << "fare and two fares differ: yes\n";
    }
    // fare += 25;                   // Try: fare is const
}
```

Once it passes, uncomment the **Try** line and tap **Run**. Clang says `no viable overloaded '+='`, and its note gives the reason: `'this' argument has type 'const Money', but method is not marked const`. `fare` is const, and `+=` rightly isn't. Put the `//` back.
