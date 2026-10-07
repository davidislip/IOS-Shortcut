---
id: 20
title: Initializing containers
concept: initializer-list constructors, std::initializer_list, push_back, reading until the input ends, std::istream&, braces prefer the list constructor, static_cast, casts
minutes: 14
source: A Tour of C++
source_pages: 38-39
---
# Initializing containers

Lesson 19's `Vector` gives its memory back by itself, but filling it is clumsy: make one of the right size, then set each element.

```cpp
Vector v(3);
v[0] = 3.25;
v[1] = 3.25;
v[2] = 1.6;
```

A `std::vector` lets you write the elements in braces, `{3.25, 3.25, 1.6}`, or add them one by one with `push_back` (lesson 6). The book (§4.2.3) calls these its two favourite ways in, and shows how your own class gets the first.

## What `{2, 1, 2, 2}` becomes

```cpp
#include <initializer_list>
#include <iostream>

int total(std::initializer_list<int> minutes) {
    int sum {0};
    for (int m : minutes) {
        sum += m;
    }
    return sum;
}

int main() {
    std::cout << total({2, 1, 2, 2}) << '\n';   // 7
    std::cout << total({4}) << '\n';            // 4
    std::cout << total({}) << '\n';             // 0
}
```

One function, called with four numbers, one, and none. The parameter type makes that possible:

- Lesson 4 called a list in braces an *initializer list*. **`std::initializer_list<int>`** (from `<initializer_list>`) is the type such a list becomes *when the receiving side asks for one*, like `total`'s parameter (`int n {5};` makes none): a standard-library type the compiler itself knows about. The compiler puts the values in a hidden array and passes a small object that refers to them.
- You can loop over it with a range-for and ask for its `size()`. It has no `[ ]` and no `push_back`, and the values are read-only.
- The values must convert without narrowing: `total({2, 1.5})` stops with lesson 4's `type 'double' cannot be narrowed to 'int'`, and so would `1.0` (`double` to `int` always narrows).

You've used one before: lesson 6's `for (auto minutes : {2, 1, 2, 2})` looped over a `std::initializer_list<int>`.

## An initializer-list constructor

A constructor whose parameter is a `std::initializer_list` is an **initializer-list constructor**. Here's lesson 19's `Vector` with the book's one added, next to the size constructor:

```cpp
#include <initializer_list>
#include <iostream>

class Vector {
public:
    Vector(int s) : elem{new double[s]{}}, sz{s} { }    // s zeros
    Vector(std::initializer_list<double> lst)           // the new one
        : elem{new double[lst.size()]}, sz{static_cast<int>(lst.size())}
    {
        int i {0};
        for (double d : lst) {    // copy the list into the new array
            elem[i] = d;
            ++i;
        }
    }
    ~Vector() { delete[] elem; }
    double& operator[](int i) { return elem[i]; }
    int size() const { return sz; }
private:
    double* elem;
    int sz;
};

int main() {
    Vector v1 = {1, 2, 3, 4, 5};
    Vector v2 {1.23, 3.45, 6.7, 8};
    std::cout << v1.size() << ' ' << v2.size() << '\n';    // 5 4
    std::cout << v2[3] << '\n';                            // 8

    Vector a(6);
    Vector b {6};
    std::cout << a.size() << ' ' << b.size() << '\n';      // 6 1
}
```

- `new double[lst.size()]` gets exactly as many doubles as the list holds; the body copies them in. (`static_cast` comes below. `: elem{…}, sz{…}` is still lesson 11's member initializer list, a different thing with a similar name.)
- The book copies in one line, `copy(lst.begin(), lst.end(), elem);`: from the list's start to its end, into `elem` (`std::copy`, an algorithm from chapter 10).
- The ints in `{1, 2, 3, 4, 5}` become doubles. That's no narrowing: each value survives (lesson 4).
- `Vector v1 = {…}` is the book's way of writing it. The `=` adds nothing here (lesson 4).
- Still don't copy a `Vector`: lesson 19's warning holds until lesson 24.

## Braces choose the list

At the end of `main`, `Vector a(6);` has six zeros, but `Vector b {6};` has **one** element, 6. When a class has an initializer-list constructor, braces pick it whenever the values can form such a list. The other constructors only get a chance if they can't. (Empty `{}` still means the default constructor, if there is one.) Parentheses never make a list.

That's the reason behind lesson 11's tip. `std::vector` has both kinds of constructor, so `std::vector<int> v(6);` is six zeros and `std::vector<int> v {6};` is one 6.

> ⚠️ It bites harder with two numbers. `std::vector<int> v(6, 1);` is six 1s (a size, then the value for every element); `std::vector<int> v {6, 1};` is two elements, 6 and 1, and both compile without a word. So for a container, write `()` for a size and `{}` for the elements: the exception to lesson 11's "keep to `{}`".

## `static_cast`: an explicit conversion

`lst.size()` returns a `size_t`, the standard library's unsigned type for sizes and counts. (It's why lesson 6's `v.size()` gave the "different signs" warning.) Leave out the cast and write `sz{lst.size()}`, and braces refuse:

```text
error: non-constant-expression cannot be narrowed from type 'size_t' (aka 'unsigned long') to 'int' in initializer list
note: insert an explicit cast to silence this issue
```

(Here an `unsigned long` is 4 bytes, like lesson 3's `unsigned`.) An `int` can't hold every value a `size_t` can: anything above 2,147,483,647 won't fit. Nobody types a list that long, but the compiler judges by type (lesson 4). As the book puts it, the type system has no common sense, but the same fussy rule catches a real bug another day.

`static_cast<int>(lst.size())` converts the size to an `int` because you say so: an **explicit conversion**, the one lesson 4's note suggested and lesson 12 used to get an enum's number. Explicit conversions are also called **casts**, and the book says the name is a reminder: like a plaster cast, a cast props up something broken.

A `static_cast` doesn't check the *value*. `static_cast<int>(2.9)` is 2, and an unsigned 4294967295 cast to `int` becomes -1, silently. The compiler takes your word for it: if you can't be sure the value fits, check it first.

Keep casts rare: each marks a spot where the types didn't fit and someone forced them. Where you can, fix the types instead (lesson 4). Older code uses C's cast, `(int)lst.size()`: the same here, but it also allows far riskier conversions without saying which. Write `static_cast`.

## Growing: `push_back` and reading until the input ends

The book's other favourite, `push_back`, is for when you don't know how many elements are coming: input, typically. Its `Vector` only declares `void push_back(double);`. Growing means a bigger array, copying the elements over and deleting the old ones; `std::vector` does all that, so the example uses it:

```cpp
#include <iostream>
#include <vector>

std::vector<double> read(std::istream& is) {
    std::vector<double> v;
    for (double d; is >> d;) {    // read numbers until there are no more
        v.push_back(d);
    }
    return v;
}

int main() {
    auto fares = read(std::cin);
    double sum {0.0};
    for (double f : fares) {
        sum += f;
    }
    std::cout << fares.size() << " fares, " << sum << " total\n";
}
```

Tap **Open in editor** and **▶ Run**, type `3.25 3.25 1.6`, press return, then tap **EOF** (lesson 9): `3 fares, 8.1 total`.

- `for (double d; is >> d;)` is a `for` with nothing in the step part. The initializer declares `d`. The condition *is* the read: `is >> d` counts as true if a number arrived.
- The read fails at the end of the input, or at something that isn't a number (lesson 9's `five`): `3.25 2 x 7` gives `2 fares, 5.25 total`.
- Why `for` and not `while (std::cin >> d)`? The `while` version needs `double d;` above the loop, where it stays in scope afterwards; the `for` keeps `d` inside (lesson 5). `d` has no initializer, but that's safe: the body only runs once `>>` has stored a number.
- `std::istream` is the type of `std::cin`: an *input stream*. Taking a `std::istream&` lets `read` work on any input stream, not just `std::cin`. It's a plain `&` because reading changes the stream, and a stream can't be copied.

The book's `read()` returns its own `Vector`. That compiles, but until lessons 24–25 give `Vector` proper copy and move constructors, the returned copy can share the local's array (lesson 19's warning). The move constructor also makes the return cheap: the book's point. `std::vector` already has both, so return one until then.

## Exercise: Timetable

A `Timetable` holds one stop's departure times, in minutes after midnight (545 is 09:05), in a `std::vector<int>`. Its invariant (lesson 11): the times are **always sorted**. `next_after` relies on it: it returns the first time later than `now`, which is only the *next* departure if the times are in order. Finish it:

1. The initializer-list constructor: `add()` each time in the list. Inside the class, plain `add(t)` works on this object, as `print()` calls `size()`. Going through `add()` means only one function has to keep the invariant.
2. `add(int t)`: after the `push_back`, move `t` left until the times are in order (a `while` loop, lesson 8; the steps are in the starter). The given `size()` holds the only `static_cast`, so `int i {size() - 1};` needs none, and nor does any code using a `Timetable`. That's the book's way to keep casts rare: bury them inside a class.
3. In `main`, read times until the input ends, with the `for` loop from this lesson, and `add()` each one.

Adding 530 to `520 545 600`:

```text
520 545 600 530   push_back(530), i = 3
520 545 600 600   600 > 530: copy it right, i = 2
520 545 545 600   545 > 530: copy it right, i = 1
520 530 545 600   520 < 530: stop, store 530 at index 1
```

> ⚠️ **Put `i > 0` first.** `&&` only looks at its right side when the left side is true, so at `i` = 0 it never reads `departures[-1]`. Reversed, the loop reads out of range (lesson 6): undefined behaviour that here even passes Check.

**Check** types these two times, then ends the input (on **▶ Run**, type them and tap **EOF**):

```stdin
530 615
```

```expected
5 departures: 08:40 08:50 09:05 10:00 10:15
next after 08:45: 08:50
next after 10:30: none
```

The starter runs, with the warning `unused parameter 'times'`, and prints `0 departures:`. Do TODOs 1 and 3 first and tap **Check**: the times come out in the order they arrived (`09:05 08:40 10:00 08:50 10:15`), and the next departure after 08:45 comes out as 09:05. `next_after` trusted an invariant nobody kept. TODO 2 fixes it.

```cpp starter
#include <initializer_list>
#include <iostream>
#include <optional>
#include <vector>

// Prints minutes after midnight as hh:mm, e.g. 545 as 09:05.
void print_time(int minutes) {
    int h {minutes / 60};
    int m {minutes % 60};
    std::cout << h / 10 << h % 10 << ':' << m / 10 << m % 10;
}

class Timetable {
public:
    Timetable(std::initializer_list<int> times) {
        // TODO 1: add() each time in the list.
    }

    void add(int t) {
        departures.push_back(t);            // room at the end
        // TODO 2: move t left until the times are in order again:
        //         - i starts at size() - 1 (where t is now)
        //         - while i > 0 and the time before i is later than t:
        //           copy that time one place right, then step i left
        //         - store t at index i
    }

    int size() const { return static_cast<int>(departures.size()); }

    void print() const {
        std::cout << size() << " departures:";
        for (int t : departures) {
            std::cout << ' ';
            print_time(t);
        }
        std::cout << '\n';
    }

    // The first departure after now, or nothing if the day's service is over.
    std::optional<int> next_after(int now) const {
        for (int t : departures) {
            if (t > now) {
                return t;
            }
        }
        return std::nullopt;
    }

private:
    std::vector<int> departures;    // minutes after midnight, always sorted
};

void print_next(const Timetable& t, int now) {
    std::cout << "next after ";
    print_time(now);
    std::cout << ": ";
    std::optional<int> next {t.next_after(now)};
    if (next) {
        print_time(*next);
    } else {
        std::cout << "none";
    }
    std::cout << '\n';
}

int main() {
    Timetable t {545, 520, 600};          // out of order on purpose
    // TODO 3: read times until the input ends, and add() each one.
    t.print();
    print_next(t, 8 * 60 + 45);
    print_next(t, 10 * 60 + 30);
}
```

```cpp solution
#include <initializer_list>
#include <iostream>
#include <optional>
#include <vector>

// Prints minutes after midnight as hh:mm, e.g. 545 as 09:05.
void print_time(int minutes) {
    int h {minutes / 60};
    int m {minutes % 60};
    std::cout << h / 10 << h % 10 << ':' << m / 10 << m % 10;
}

class Timetable {
public:
    Timetable(std::initializer_list<int> times) {
        for (int t : times) {
            add(t);
        }
    }

    void add(int t) {
        departures.push_back(t);            // room at the end
        int i {size() - 1};                 // where t is now
        while (i > 0 && departures[i - 1] > t) {
            departures[i] = departures[i - 1];   // a later time moves right
            --i;
        }
        departures[i] = t;
    }

    int size() const { return static_cast<int>(departures.size()); }

    void print() const {
        std::cout << size() << " departures:";
        for (int t : departures) {
            std::cout << ' ';
            print_time(t);
        }
        std::cout << '\n';
    }

    // The first departure after now, or nothing if the day's service is over.
    std::optional<int> next_after(int now) const {
        for (int t : departures) {
            if (t > now) {
                return t;
            }
        }
        return std::nullopt;
    }

private:
    std::vector<int> departures;    // minutes after midnight, always sorted
};

void print_next(const Timetable& t, int now) {
    std::cout << "next after ";
    print_time(now);
    std::cout << ": ";
    std::optional<int> next {t.next_after(now)};
    if (next) {
        print_time(*next);
    } else {
        std::cout << "none";
    }
    std::cout << '\n';
}

int main() {
    Timetable t {545, 520, 600};          // out of order on purpose
    for (int m; std::cin >> m;) {
        t.add(m);
    }
    t.print();
    print_next(t, 8 * 60 + 45);
    print_next(t, 10 * 60 + 30);
}
```

Once it passes, change `size() - 1` in `add` to `departures.size() - 1` and tap **▶ Run**: the narrowing error from above, with its `insert an explicit cast` note (a vector's size type is called `size_type`). Change it back.

Section 4.3, further down p. 39, turns to a different kind of class, the abstract type: lesson 21.
