---
id: 22
title: Class hierarchies
concept: class hierarchies, is a kind of, derived classes adding members, calling a base class constructor, calling a base version with Base::f(), new virtual functions in a derived class, virtual destructors, override, near misses in overriding
minutes: 15
source: A Tour of C++
source_pages: 42-45
---
# Class hierarchies

Lesson 21's `Vector_container` was derived from `Container`: the smallest possible **class hierarchy**, a set of classes built on one another by derivation (`: public`). Section 4.5 (bottom of p. 42) builds taller ones.

Hierarchies model "is a kind of" chains: an express is a kind of train, which is a kind of vehicle. The book's example is shapes on a screen:

```text
          Shape
         /     \
    Circle     Triangle
       |
    Smiley
```

Each line joins a derived class (below) to its base (above). A Smiley is a kind of Circle (a circle with eyes and a mouth), so it's also a kind of Shape.

## The top: an interface

Here's the book's `Shape` (p. 43). The book never defines `Point`; a lesson-10 struct with default values will do:

```cpp
struct Point {
    int x {0};
    int y {0};
};

class Shape {
public:
    virtual Point center() const = 0;   // pure virtual (lesson 21)
    virtual void move(Point to) = 0;
    virtual void draw() const = 0;      // draw on the screen
    virtual void rotate(int angle) = 0;
    virtual ~Shape() {}
};
```

`Shape` is an abstract class like `Container`: no data, just an interface. That's enough to write code for every kind of shape, such as the book's `rotate_all`:

```cpp
void rotate_all(std::vector<Shape*>& v, int angle) {
    for (auto p : v) {
        p->rotate(angle);    // each shape's own rotate()
    }
}
```

Why a vector of *pointers*? A `std::vector<Shape>` holds Shapes, all one type and one size, but a Circle and a Smiley aren't even the same size. (And since `Shape` is abstract, nothing could go in one.) So the vector holds addresses, all one size, and each `p->rotate` is a virtual call. A `Circle*` converts to a `Shape*` by itself, because a Circle *is* a Shape.

## Building on a class

Here are the book's `Circle` and `Smiley` (pp. 43–44), cut down to `wink()` and a `draw()` that prints a line. Tap **Open in editor** and **▶ Run**:

```cpp
#include <iostream>
#include <vector>

struct Point {
    int x {0};
    int y {0};
};

class Shape {
public:
    virtual void draw() const = 0;
    virtual ~Shape() {}
};

class Circle : public Shape {
public:
    Circle(Point c, int r) : middle{c}, radius{r} { }
    void draw() const override {
        std::cout << "circle at " << middle.x << ',' << middle.y
                  << ", radius " << radius << '\n';
    }
private:
    Point middle;                                // the center
    int radius;
};

class Smiley : public Circle {                   // a Smiley is a Circle...
public:
    Smiley(Point c, int r) : Circle{c, r} { }    // ...so build the Circle first
    void draw() const override {
        Circle::draw();                          // the face, drawn by Circle
        std::cout << "  with eyes and a smile";
        if (winking_eye > 0) {
            std::cout << ", eye " << winking_eye << " winking";
        }
        std::cout << '\n';
    }
    virtual void wink(int i) { winking_eye = i; }   // new: Shape has no wink
private:
    int winking_eye {0};                         // 0: no wink
};

void draw_all(const std::vector<const Shape*>& v) {
    for (auto p : v) {
        p->draw();
    }
}

int main() {
    Circle sun {{0, 0}, 5};      // center {0, 0}, radius 5
    Smiley face {{10, 4}, 3};
    face.wink(2);
    std::vector<const Shape*> shapes {&sun, &face};
    draw_all(shapes);
}
```

```text
circle at 0,0, radius 5
circle at 10,4, radius 3
  with eyes and a smile, eye 2 winking
```

`draw_all` only reads, so it takes `const Shape*`s (like lesson 8's `const char*`), which allow only const member functions (lesson 18). `rotate_all` changes shapes, so it needs plain `Shape*`s.

`Smiley` shows three new things.

### The base class's constructor

A Smiley contains a whole Circle. Here's `face` from above:

```text
 face
+-----------------+
| vtbl:   o-------+--> Smiley's vtbl  \
| middle: 10,4    |                    |  the Circle part
| radius: 3       |                   /
+-----------------+
| winking_eye: 2  |                      Smiley's own
+-----------------+
```

The Circle part is Circle's to set up, so a Circle constructor must run: `: Circle{c, r}` calls it, in Smiley's member initializer list (lesson 11). The base is always built first, then the members, then the constructor's body, whatever order you write. So write the base first too: `: winking_eye{0}, Circle{c, r}` makes Clang warn `field 'winking_eye' will be initialized after base 'Circle'`. Leave the base out and Clang stops with `constructor for 'Smiley' must explicitly initialize the base class 'Circle' which does not have a default constructor`.

### Calling the base's version

Smiley's `draw()` overrides Circle's, but it still wants the circle drawn. `Circle::draw()` names Circle's version with lesson 13's `Class::`, so it's called directly, with no virtual call.

Smiley couldn't draw the circle itself anyway: `middle` and `radius` are private to Circle, even for a derived class (`'radius' is a private member of 'Circle'`). A Smiley reaches its own Circle part through Circle's public functions, like everyone else.

> ⚠️ Forget the `Circle::` and `draw()` means this object's `draw()`: Smiley's, the very function you're in. It calls itself, forever. (A function that calls itself is **recursive**.) Clang warns `all paths through this function will call itself`, and on **Run** the app reports 💥 Stack overflow.

### New members

A derived class can add data members (`winking_eye`), ordinary functions and even new virtual functions: no Shape has `wink`, but a class derived from Smiley could override it. Through a `Shape*`, only Shape's interface exists: `shapes[1]->wink(1)` fails with `no member named 'wink' in 'Shape'`, even for a Smiley. Lesson 23 shows how to ask a Shape whether it's a Smiley.

## The book's Smiley owns its eyes

In the book, a Smiley's eyes and mouth are Shapes too, made with `new` and handed over as pointers. So Smiley has a destructor (p. 44, shortened):

```cpp
class Smiley : public Circle {
public:
    Smiley(Point p, int r) : Circle{p, r}, mouth{nullptr} { }
    ~Smiley() {
        delete mouth;
        for (auto p : eyes) {
            delete p;
        }
    }
    void add_eye(Shape* s) { eyes.push_back(s); }
    virtual void wink(int i);    // wink eye number i
    // ... move(), draw(), rotate() and set_mouth() ...
private:
    std::vector<Shape*> eyes;    // usually two
    Shape* mouth;
};
```

The eyes and mouth are resources (lesson 19): the Smiley owns them, so its destructor gives them back, by hand. Lesson 23 swaps the raw pointers for `std::unique_ptr`, and the destructor disappears.

(The book's out-of-class `void Smiley::draw()` lost its `const`: it must be `void Smiley::draw() const`.)

## Virtual destructors

`delete p` deletes an eye through a `Shape*`. That eye might be a Circle, or a Smiley with eyes of its own. Which destructor runs? Run this (its naked `new` is just for the demo):

```cpp
#include <iostream>

class Shape {
public:
    virtual void draw() const = 0;
    virtual ~Shape() { std::cout << "~Shape\n"; }
};

class Circle : public Shape {
public:
    void draw() const override { std::cout << "circle\n"; }
    ~Circle() { std::cout << "~Circle\n"; }
};

class Smiley : public Circle {
public:
    void draw() const override { std::cout << "smiley\n"; }
    ~Smiley() { std::cout << "~Smiley\n"; }
};

int main() {
    Shape* p {new Smiley};    // a Smiley, used through a Shape*
    p->draw();
    delete p;                 // which destructors run?
}
```

```text
smiley
~Smiley
~Circle
~Shape
```

`~Shape` is virtual, so `delete` works like any virtual call: it runs the destructor of the object's real type, the most derived class. Each destructor then destroys its members and runs its base's destructor. That's construction in reverse (lesson 19): the base is built first and destroyed last.

Now delete the `virtual` in front of `~Shape` and run again. Clang warns `delete called on 'Shape' that is abstract but has non-virtual destructor`, and the output shrinks to `smiley`, `~Shape`. The Smiley and Circle parts are never destroyed, so any eyes they owned would leak. (Officially it's undefined behaviour, lesson 2.) That's why lesson 21's interfaces got a virtual destructor, though they have nothing to clean up.

> 💡 The rule of thumb: a class with a virtual function gets a virtual destructor.

## `override`: say what you mean

Every `draw()` above is marked `override`, as lesson 21 advised. §4.5.1 explains why. A function overrides a virtual function only if it matches **exactly**: same name, same parameter types, same `const`. Anything else is a new, separate function, and the language allows it. (Destructors are the exception: a derived destructor overrides a virtual one despite the different name, and is usually left unmarked.)

Say Smiley's draw had no `override` and lost its `const`: `void draw() { … }`. It no longer overrides anything, and `draw_all` quietly uses Circle's version: a face with no eyes. Here Clang happens to warn (`'Smiley::draw' hides overloaded virtual function`). Misspell the name as `drew` and nothing warns at all.

Write `override` and each near miss becomes an error, on the line itself:

```cpp
void drew() const override;   // name misspelled
void draw() override;         // const missing
```

For `drew`, Clang says `only virtual member functions can be marked 'override'`. Read it as "this overrides nothing, so it isn't virtual". For `draw`, it's the `... hides virtual member function` error from lesson 21's exercise, with its note about `const`.

`only virtual member functions can be marked 'override'` also catches a slip in the *base*: a forgotten `virtual`.

```cpp
class Train {
public:
    void describe() const { std::cout << "a train\n"; }   // virtual forgotten
    virtual ~Train() {}
};

class Express : public Train {
public:
    void describe() const { std::cout << "an express\n"; }
};

void show(const Train& t) { t.describe(); }
```

Pass an Express to `show` and it prints `a train`. Without `virtual`, a call through a `Train&` always runs Train's version, and nothing warns. Add `override` to Express's `describe()`, and the build stops with that error.

`override` only adds a check: the book's Smiley (p. 44), written without it, overrides just the same. And a new function like `wink` must not have it: `virtual void wink(int i) override;` gives `'wink' marked 'override' but does not override any member functions`.

The modern habit: `virtual` on the function in the base that introduces it, `override` on every function that overrides it (no need to repeat `virtual` there), destructors aside.

## Exercise: Announcements

A platform screen shows announcements. `Announcement` and an outline of `class Arrival : public Announcement` are given. Write:

1. Arrival's constructor, `Arrival(const std::string& line, int minutes)`.
2. Arrival's `std::string text() const override`, which returns e.g. `Yonge train in 3 min`.
3. `class Delayed_arrival : public Arrival`, with the constructor `Delayed_arrival(const std::string& line, int minutes, int delay)`. Its member initializer list passes `line` and `minutes` on with `Arrival{line, minutes}`, then stores the delay. Its `text()` returns Arrival's text plus `, delayed <delay> min`.

Hints: `+` joins text to text, never numbers (lesson 4); `std::to_string(3)` turns a number into the text `"3"` (it's in `<string>`). `Delayed_arrival` can't read `line_name` or `wait`, which are private to Arrival: call `Arrival::text()`.

`main` is written: it makes three announcements and shows them through `const Announcement*`s.

```expected
Yonge train in 3 min
Bloor train in 8 min, delayed 5 min
Sheppard train in 12 min
```

The starter won't compile until all three are written. The first error, `variable type 'Arrival' is an abstract class`, comes with a note naming the missing `text`: that's TODO 2. (The warning `private field 'wait' is not used` goes once `text()` uses `wait`.)

```cpp starter
#include <iostream>
#include <string>
#include <vector>

class Announcement {
public:
    virtual std::string text() const = 0;
    virtual ~Announcement() {}
};

class Arrival : public Announcement {
public:
    // TODO 1: the constructor Arrival(const std::string& line, int minutes):
    //         line_name gets line, wait gets minutes.

    // TODO 2: std::string text() const override
    //         returns e.g. "Yonge train in 3 min"

private:
    std::string line_name;
    int wait;               // minutes until it arrives
};

// TODO 3: class Delayed_arrival : public Arrival
//         - the constructor Delayed_arrival(const std::string& line,
//           int minutes, int delay): Arrival{line, minutes} first,
//           then delay_minutes gets delay
//         - std::string text() const override: Arrival's text,
//           then ", delayed <delay> min"
//         - private: int delay_minutes;

int main() {
    Arrival yonge {"Yonge", 3};
    Delayed_arrival bloor {"Bloor", 8, 5};
    Arrival sheppard {"Sheppard", 12};

    std::vector<const Announcement*> board {&yonge, &bloor, &sheppard};
    for (auto a : board) {
        std::cout << a->text() << '\n';
    }
}
```

```cpp solution
#include <iostream>
#include <string>
#include <vector>

class Announcement {
public:
    virtual std::string text() const = 0;
    virtual ~Announcement() {}
};

class Arrival : public Announcement {
public:
    Arrival(const std::string& line, int minutes) : line_name{line}, wait{minutes} { }

    std::string text() const override {
        return line_name + " train in " + std::to_string(wait) + " min";
    }

private:
    std::string line_name;
    int wait;               // minutes until it arrives
};

class Delayed_arrival : public Arrival {
public:
    Delayed_arrival(const std::string& line, int minutes, int delay)
        : Arrival{line, minutes}, delay_minutes{delay} { }

    std::string text() const override {
        return Arrival::text() + ", delayed " + std::to_string(delay_minutes) + " min";
    }

private:
    int delay_minutes;      // how late it is
};

int main() {
    Arrival yonge {"Yonge", 3};
    Delayed_arrival bloor {"Bloor", 8, 5};
    Arrival sheppard {"Sheppard", 12};

    std::vector<const Announcement*> board {&yonge, &bloor, &sheppard};
    for (auto a : board) {
        std::cout << a->text() << '\n';
    }
}
```

Once it passes, misspell `text` as `txt` in `Delayed_arrival` and tap **Run**: `only virtual member functions can be marked 'override'`. Now delete that `override` too. It compiles, and the Bloor line loses its delay: `txt` is a new function nobody calls, and the board uses Arrival's `text()`. That's the silent near miss `override` exists for. Put `text` and `override` back.
