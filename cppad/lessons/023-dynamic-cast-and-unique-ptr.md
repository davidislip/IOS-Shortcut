---
id: 23
title: dynamic_cast and unique_ptr
concept: interface inheritance, implementation inheritance, hierarchy objects on the free store, factory functions, ownership, dynamic_cast, declarations in conditions, bad_cast, std::unique_ptr, std::make_unique, vectors of unique_ptr, get()
minutes: 15
source: A Tour of C++
source_pages: 46-48
---
# dynamic_cast and unique_ptr

Lesson 22's shapes and announcements were local variables in `main`. Real programs often learn only while running which kinds of object they need. Pages 46–48 cover that case: objects made with `new` and used through base pointers, `dynamic_cast` to get the real type back, and `std::unique_ptr` to do the deleting.

## Two things a hierarchy gives you

- **Interface inheritance**: code that knows only the base works with every derived class. The base serves as an interface, usually abstract and without data, like lesson 21's `Fare_rule`.
- **Implementation inheritance**: a derived class reuses what its base already has, as Smiley reuses Circle's constructor and `Circle::draw()` (lesson 22). Such a base usually has data and a constructor.

## Hierarchy objects usually live on the free store

A concrete type such as lesson 18's `Money` behaves like an `int`: local variables, copied around. Hierarchy objects are usually made with `new` and used through base pointers (or references).

The book's example reads shapes from input. A **factory function** decides which kind of object to make, makes it and hands it back. Here's the book's `read_shape` (p. 46), with the reading left as comments:

```cpp
enum class Kind { circle, triangle, smiley };

Shape* read_shape(std::istream& is) {    // read shape descriptions from is
    // ... read which kind of shape comes next, into k ...
    switch (k) {
    case Kind::circle:
        // ... read its center p and radius r ...
        return new Circle{p, r};
    // ... case Kind::triangle: much the same, with three corners ...
    case Kind::smiley:
        // ... read p, r, two eyes e1 and e2, and a mouth m ...
        Smiley* ps = new Smiley{p, r};
        ps->add_eye(e1);
        ps->add_eye(e2);
        ps->set_mouth(m);
        return ps;
    }
    return nullptr;    // not in the book: lesson 12's loophole
}
```

Every kind comes back as a `Shape*` (lesson 22). The book's `switch` has no final `return`, but lesson 12's loophole (an enum can hold a value with no enumerator) needs the `return nullptr;` added above.

The book then uses it like this:

```cpp
void user() {
    std::vector<Shape*> v;
    // ... push_back(read_shape(std::cin)) until the input ends ...
    draw_all(v);          // call draw() for each element
    rotate_all(v, 45);    // call rotate(45) for each element
    for (auto p : v) {    // remember to delete the elements
        delete p;
    }
}
```

(The book's `while (cin)` loop pushes one extra shape, read from nothing, after the last one; lesson 20's `for` loop doesn't.)

Like lesson 21's `use()`, `user()` never names Circle or Smiley, only Shape, so a new kind of Shape needs no change to it, not even a recompile.

Nobody else keeps a pointer to the shapes, so `user()` **owns** them: the **owner** of an object is whoever must delete it. Shape's virtual destructor (lesson 22) makes each `delete p` reach the real class's destructor, down to a Smiley's eyes and mouth.

## Which kind is it? `dynamic_cast`

`read_shape` hands back a `Shape*`, and through a `Shape*` you can't call Smiley's `wink()` (lesson 22). You first have to ask "is this Shape a Smiley?", and **`dynamic_cast`** does that. It looks like lesson 20's `static_cast`, which checks nothing: `static_cast<Smiley*>(ps)` compiles even when `ps` points to a plain Circle, and using the result is undefined behaviour. `dynamic_cast` checks. Tap **Open in editor** and **▶ Run**:

```cpp
#include <iostream>
#include <vector>

class Shape {
public:
    virtual void draw() const = 0;
    virtual ~Shape() {}
};

class Circle : public Shape {
public:
    Circle(int radius) : r{radius} { }
    void draw() const override { std::cout << "circle, radius " << r << '\n'; }
private:
    int r;
};

class Smiley : public Circle {
public:
    Smiley(int radius) : Circle{radius} { }
    void draw() const override {
        Circle::draw();
        std::cout << "  with a face\n";
    }
    virtual void wink() const { std::cout << "  ;-)\n"; }
};

int main() {
    Circle plain {2};
    Smiley happy {5};
    std::vector<Shape*> shapes {&plain, &happy};   // pointers to locals: no delete
    for (Shape* ps : shapes) {
        ps->draw();
        if (Smiley* p = dynamic_cast<Smiley*>(ps)) {
            p->wink();                        // p is a Smiley*: wink works
        } else {
            std::cout << "  not a smiley\n";
        }
    }
}
```

```text
circle, radius 2
  not a smiley
circle, radius 5
  with a face
  ;-)
```

- `dynamic_cast<Smiley*>(ps)` checks, while the program runs, what `ps` really points to. If it's a Smiley, or a class derived from Smiley, you get a `Smiley*` to it. Otherwise you get `nullptr`.
- The class you cast from must be polymorphic, with a virtual function (lesson 21); otherwise Clang says `'Shape' is not polymorphic`. In practice the answer comes from the hidden vtbl pointer, which only such classes have.
- `if (Smiley* p = dynamic_cast<Smiley*>(ps))` declares `p` inside the condition, and the `if` tests the value it starts with: `nullptr` counts as false (lesson 8). `p` exists only in that `if` and its `else`, so it can't be used by mistake further down. (In a condition, `=` is the usual form, as in a `for` header, lesson 6.)

You can also cast to a reference:

```cpp
Smiley& r {dynamic_cast<Smiley&>(*ps)};    // the book: somewhere, catch std::bad_cast
```

A reference can't be null, so for a non-Smiley, standard C++ throws `std::bad_cast`. With exceptions off (lesson 15), this app just stops with 💥 Program aborted, and its list of common causes doesn't mention `dynamic_cast`. Use the reference form only where any other class would be a bug; otherwise cast to a pointer and test it.

> 💡 Use `dynamic_cast` sparingly. If code keeps asking "which kind is it?", a virtual function is usually better: each class does its own thing, a new class needs no new `if`, and a virtual call is cheaper than a run-time type check. `dynamic_cast` earns its place when objects pass through code that knows only the base class and come back out needing their real type.

## Who deletes? `std::unique_ptr`

`read_shape` invites two mistakes:

- a caller forgets to delete the pointer `read_shape` returned;
- the owner of a `std::vector<Shape*>` forgets to delete the elements, or returns early and skips the loop (lesson 19's naked `delete`).

A function that returns a plain, or *naked*, pointer to a new object is dangerous: nothing in the type `Shape*` says "you own this now".

The fix is **`std::unique_ptr`**, from `<memory>`: an RAII handle (lesson 19) for one object on the free store. It owns the object and deletes it when the `unique_ptr` itself is destroyed, at the end of its scope or with the vector that holds it. You use it like a pointer, with `->` and `*`:

```cpp
void show() {
    std::unique_ptr<Shape> p {new Circle{2}};    // p owns the new Circle
    p->draw();
}   // p goes out of scope and deletes the Circle
```

A `unique_ptr` can also hold `nullptr`, meaning "owns nothing", and `if (p)` tests for that. Calling `->` on an empty one is lesson 8's null-pointer mistake.

The book writes the `new` itself, as `show()` does. Since C++14 you write **`std::make_unique`**, which does it for you: `std::make_unique<Circle>(2)` makes a Circle of radius 2 and returns a `std::unique_ptr<Circle>`. That converts to a `std::unique_ptr<Shape>` when it comes straight from a function, as `Circle*` converts to `Shape*`. The arguments go in parentheses, since `make_unique` is a function call, so lesson 4's narrowing check doesn't apply: `std::make_unique<Circle>(2.7)` quietly makes radius 2.

Here are the same shapes, now owned. The destructors print, for the lesson only. Run it:

```cpp
#include <iostream>
#include <memory>
#include <vector>

class Shape {
public:
    virtual void draw() const = 0;
    virtual ~Shape() {}
};

class Circle : public Shape {
public:
    Circle(int radius) : r{radius} { }
    ~Circle() { std::cout << "circle " << r << " deleted\n"; }
    void draw() const override { std::cout << "circle, radius " << r << '\n'; }
private:
    int r;
};

class Smiley : public Circle {
public:
    Smiley(int radius) : Circle{radius} { }
    ~Smiley() { std::cout << "smiley deleted\n"; }
    void draw() const override {
        Circle::draw();
        std::cout << "  with a face\n";
    }
};

std::unique_ptr<Shape> make_shape(bool happy, int radius) {    // a factory
    if (happy) {
        return std::make_unique<Smiley>(radius);
    }
    return std::make_unique<Circle>(radius);
}

int main() {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(make_shape(false, 2));
    shapes.push_back(make_shape(true, 5));
    for (const auto& p : shapes) {
        p->draw();
    }
    std::cout << "end of main\n";
}   // shapes is destroyed, and each unique_ptr deletes its shape
```

```text
circle, radius 2
circle, radius 5
  with a face
end of main
smiley deleted
circle 5 deleted
circle 2 deleted
```

- `make_shape` is a factory whose return type says who owns the result: the caller.
- `push_back` hands each `unique_ptr` to the vector, which now owns both shapes.
- There's no `delete` anywhere. When `shapes` is destroyed, each `unique_ptr` in it deletes its shape, and the virtual destructor runs Smiley's destructor, then Circle's. (This library destroys a vector's elements last to first; the standard promises no order, so don't rely on it.)

That's the book's `user()`, minus the `delete` loop. Its `draw_all()` and `rotate_all()` would need versions for this vector (§5.5 shows a way round that); here a range-for does the job.

When you need a plain pointer, for `dynamic_cast` say, `p.get()` lends you the one inside: `dynamic_cast<Smiley*>(p.get())`. It owns nothing: use it while the `unique_ptr` still holds the object, and never `delete` it.

> ⚠️ **A unique_ptr can't be copied.** "Unique" means one owner. Lesson 22's `for (auto p : v)` was fine for plain pointers; over `shapes`, each turn would copy a `unique_ptr`, making two owners of one shape. Clang refuses: `call to implicitly-deleted copy constructor of 'std::unique_ptr<Shape>'`. Loop with `const auto&`. `shapes.push_back(p)` with a named `unique_ptr` `p` fails too (a long error; the note starting `main.cpp:` points at your line). A factory's result is different: a nameless temporary that nothing else can use, so the vector may take it over. Taking over a named `p`, still usable, needs your say-so: `std::move`, lesson 25.

That finishes lesson 22's Smiley: make its eyes and mouth `unique_ptr`s, and the hand-written destructor goes.

```cpp
class Smiley : public Circle {
public:
    Smiley(Point p, int r) : Circle{p, r} { }    // mouth starts empty
    // no ~Smiley()
    // ... add_eye(), set_mouth(), wink(), draw() ...
private:
    std::vector<std::unique_ptr<Shape>> eyes;    // each eye deleted with its Smiley
    std::unique_ptr<Shape> mouth;
};
```

When a Smiley dies, its members die with it (lesson 19), and each `unique_ptr` deletes what it owns: nothing to forget. (`add_eye` now takes a `std::unique_ptr<Shape>`; storing it needs `std::move`, lesson 25.)

For an object that several parts of a program share, there's `std::shared_ptr` (book §11.2.1), but usually one owner is the right design.

## Exercise: Depot inventory

The depot reads its vehicles from input: a kind (`bus` or `train`), then a number, which is a bus's seats or a train's cars (50 seats each). The classes are written. Only `Train` has `cars()`: a bus has no cars, so `cars()` doesn't belong in Vehicle's interface, yet the depot stores only Vehicles: the 💡's fair use of `dynamic_cast`.

1. `make_vehicle(kind, n)`: return `std::make_unique<Bus>(n)` for `"bus"`, `std::make_unique<Train>(n)` for `"train"`, and `nullptr` for anything else.
2. In the reading loop, push `make_vehicle(kind, n)` straight into `depot` (a named variable would need `std::move`: see the ⚠️). If the one you just pushed owns nothing, print `unknown vehicle: <kind>` and remove it. `depot.back()` is a vector's last element, and `depot.pop_back()` removes it. Forget the `pop_back()` and the listing loop calls `describe()` through the empty one: 💥 Program crashed.
3. In the listing loop, add each vehicle's `seats()` to `total`.
4. In a second range-for, find each vehicle that is a `Train` (`dynamic_cast` on `v.get()`, in an `if` like the Smiley example's) and keep the largest `cars()` in `longest`.

On **▶ Run**, type the line below, press return, then tap **EOF** to end the input; **Check** feeds it in for you.

```stdin
bus 40 train 6 ferry 1 train 4
```

```expected
unknown vehicle: ferry
bus: 40 seats
train: 6 cars, 300 seats
train: 4 cars, 200 seats
total seats: 540
longest train: 6 cars
```

The starter compiles, with the warnings `unused parameter 'kind'` and `unused parameter 'n'` (TODO 1 uses them), and prints `total seats: 0` and `longest train: 0 cars`.

```cpp starter
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Vehicle {
public:
    virtual void describe() const = 0;    // prints one line about it
    virtual int seats() const = 0;
    virtual ~Vehicle() {}
};

class Bus : public Vehicle {
public:
    Bus(int n) : seat_count{n} { }
    void describe() const override { std::cout << "bus: " << seat_count << " seats\n"; }
    int seats() const override { return seat_count; }
private:
    int seat_count;
};

constexpr int seats_per_car {50};

class Train : public Vehicle {
public:
    Train(int n) : car_count{n} { }
    void describe() const override {
        std::cout << "train: " << car_count << " cars, " << seats() << " seats\n";
    }
    int seats() const override { return car_count * seats_per_car; }
    int cars() const { return car_count; }    // only trains have cars
private:
    int car_count;
};

// A new vehicle of that kind, or nullptr if the depot doesn't know the kind.
std::unique_ptr<Vehicle> make_vehicle(const std::string& kind, int n) {
    // TODO 1: std::make_unique<Bus>(n) for "bus",
    //         std::make_unique<Train>(n) for "train", otherwise nullptr.
    return nullptr;
}

int main() {
    std::vector<std::unique_ptr<Vehicle>> depot;
    for (std::string kind; std::cin >> kind;) {
        int n {0};
        std::cin >> n;
        // TODO 2: push make_vehicle(kind, n) straight into depot. If the
        //         last element owns nothing, print "unknown vehicle: <kind>"
        //         and remove it.
    }

    int total {0};
    for (const auto& v : depot) {
        v->describe();
        // TODO 3: add v's seats to total
    }
    std::cout << "total seats: " << total << '\n';

    int longest {0};
    // TODO 4: for each vehicle that is a Train (dynamic_cast on v.get()),
    //         keep the largest cars() in longest.
    std::cout << "longest train: " << longest << " cars\n";
}
```

```cpp solution
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Vehicle {
public:
    virtual void describe() const = 0;    // prints one line about it
    virtual int seats() const = 0;
    virtual ~Vehicle() {}
};

class Bus : public Vehicle {
public:
    Bus(int n) : seat_count{n} { }
    void describe() const override { std::cout << "bus: " << seat_count << " seats\n"; }
    int seats() const override { return seat_count; }
private:
    int seat_count;
};

constexpr int seats_per_car {50};

class Train : public Vehicle {
public:
    Train(int n) : car_count{n} { }
    void describe() const override {
        std::cout << "train: " << car_count << " cars, " << seats() << " seats\n";
    }
    int seats() const override { return car_count * seats_per_car; }
    int cars() const { return car_count; }    // only trains have cars
private:
    int car_count;
};

// A new vehicle of that kind, or nullptr if the depot doesn't know the kind.
std::unique_ptr<Vehicle> make_vehicle(const std::string& kind, int n) {
    if (kind == "bus") {
        return std::make_unique<Bus>(n);
    }
    if (kind == "train") {
        return std::make_unique<Train>(n);
    }
    return nullptr;                           // nothing made
}

int main() {
    std::vector<std::unique_ptr<Vehicle>> depot;
    for (std::string kind; std::cin >> kind;) {
        int n {0};
        std::cin >> n;
        depot.push_back(make_vehicle(kind, n));
        if (!depot.back()) {                  // it owns nothing
            std::cout << "unknown vehicle: " << kind << '\n';
            depot.pop_back();
        }
    }

    int total {0};
    for (const auto& v : depot) {
        v->describe();
        total += v->seats();
    }
    std::cout << "total seats: " << total << '\n';

    int longest {0};
    for (const auto& v : depot) {
        if (Train* t = dynamic_cast<Train*>(v.get())) {
            if (t->cars() > longest) {
                longest = t->cars();
            }
        }
    }
    std::cout << "longest train: " << longest << " cars\n";
}
```

Once it passes, change `const auto& v` in the listing loop to `auto v` and tap **Run**: `call to implicitly-deleted copy constructor of 'std::unique_ptr<Vehicle>'`, the ⚠️ above. Put the `const auto&` back.

Every vehicle was deleted by its `unique_ptr`. Next, the book turns to copying and moving objects (§4.6, p. 48), where that deleted copy constructor comes from.
