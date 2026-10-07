---
id: 16
title: Invariants and std::expected
concept: preconditions, half-open ranges, class invariants, constructors that check their arguments, length_error, bad_alloc, rethrowing, assert, macros, NDEBUG, bugs vs bad input, std::expected, std::unexpected
minutes: 15
source: A Tour of C++
source_pages: 29-30
---
# Invariants and std::expected

Lesson 11's fare card had a gap, as its exercise admitted: nothing stops `Fare_card card {-500};`, a card that starts out owing money. Section 3.4.2 of the book names the promises code relies on, preconditions and invariants. This lesson checks them with two tools that run here: `assert` for mistakes in the program, and C++23's `std::expected` for bad data from outside.

## Preconditions

In lesson 15, the book's `operator[]` refused an index outside the Vector. An index in range is a **precondition**: something that must be true before a function runs, or the function can't do its job.

The book states this one as "the index must be in the `[0:size())` range". That's a **half-open range**: the `[` says 0 is in it, the `)` says `size()` is not. For a 6-element Vector that's 0 to 5, exactly what `for (int i = 0; i < v.size(); ++i)` walks: from 0, stopping before `size()`.

The book's rule of thumb: know what each of your functions takes for granted, and test it when that's practical. Some things you can't test (a pointer can't tell you how many elements follow it), and some cost too much in code that runs millions of times. That's why `std::vector`'s `[]` doesn't check and `.at()` does (lesson 15).

## Class invariants, again

Lesson 11's invariant (a rule always true of an object's data) gets its full name in the book: a **class invariant**. The book's Vector has one: "`elem` points to an array of `sz` doubles". `operator[]` and `size()` are nonsense without it. So the work is split:

- The constructor **establishes** the invariant: when it finishes, the rule is true.
- Every member function **keeps** it: whatever it changes, the rule is true again when it returns.

Writing the invariant down forces you to say exactly what the class promises, and that, the book argues, makes correct code more likely.

### The book's fix: a constructor that throws

Lesson 11's Vector constructor trusts its caller, handing `s` straight to `new` and `sz`. The book predicts chaos from `Vector v(-27);`. In a test here the program didn't even stop, which is worse: it carried on with a Vector whose `size()` is −27, and nobody noticed. The book's fix checks first, in a definition outside the class (lesson 13):

```cpp
Vector::Vector(int s) {             // the book's fix, p. 29
    if (s < 0) {
        throw std::length_error{"Vector: negative size"};
    }
    elem = new double[s];
    sz = s;
}
```

It sets the members in the body, not a member initializer list (lesson 11), so the check runs before `new`. `std::length_error` is the standard library's exception for a size that makes no sense. (The book's `length_error{}` lacks the message this type needs, and its "non-positive" means negative: an empty Vector is fine.)

When the free store runs out, `new` itself throws `std::bad_alloc`. A caller that wants to react to either catches them:

```cpp
void test()                 // after the book, p. 30
{
    try {
        Vector v(-27);
    }
    catch (const std::length_error&) {
        std::cout << "test failed: length error\n";
        throw;              // rethrow: pass the same exception on
    }
    catch (const std::bad_alloc&) {
        std::terminate();   // test() can't cope with running out of memory
    }
}
```

Two new moves: a handler can clean up a little, then **rethrow** the same exception to `test()`'s caller with a bare `throw;`. And when there's no way forward, `std::terminate()` (lesson 15) ends the program.

Neither fragment compiles here (lesson 15), but their rule does apply: **a constructor that can't establish its invariant must not produce an object.** `std::vector` follows it. `std::vector<double> v(-27);` compiles (the −27 becomes a huge unsigned size, lesson 3), and running it stops at once:

```text
length_error was thrown in -fno-exceptions mode with message "vector"
```

then 💥 Program aborted. That's why the book picked `length_error`: the library reports the same problem with it. With exceptions off, it stops the program instead.

## Bug or bad data?

Without exceptions, who stops `Fare_card card {-500};`? That depends on where the −500 came from.

- **A bug.** The program's own code passed −500. Nothing sensible can follow, so stop right there, loudly. That's `assert`.
- **Bad data from outside.** A rider typed −500 at a machine. People mistype, and the program must cope. Tell the caller what went wrong and let it decide. That's `std::expected`.

## `assert`: stop on a bug

```cpp
#include <cassert>
#include <iostream>

class Ticket {                  // invariant: 1 <= zones <= 4
public:
    Ticket(int z) : zones{z} {
        assert(1 <= z && z <= 4 && "a ticket covers 1 to 4 zones");
    }
    int price() { return 325 + 50 * (zones - 1); }
private:
    int zones;
};

int main() {
    Ticket a {2};
    std::cout << "2 zones: " << a.price() << " cents\n";
    Ticket b {7};
    std::cout << "7 zones: " << b.price() << " cents\n";
}
```

It prints `2 zones: 375 cents`, then stops at `Ticket b {7};` with this, and 💥 Program aborted:

```text
Assertion failed: 1 <= z && z <= 4 && "a ticket covers 1 to 4 zones" (main.cpp: Ticket: 7)
```

- `assert(condition)`, from `<cassert>`, tests the condition while the program runs. If it's true, nothing happens. If it's false, it prints the condition, file, function and line, then stops the program by calling `abort()`.
- The `&& "…"` is a trick to add a message. A string literal counts as true (it's a pointer that isn't `nullptr`, lesson 8), so it doesn't change the test, but it shows up in the printout.
- The constructor checks its precondition, so while asserts are on, every Ticket keeps the invariant and `price()` can rely on it. The check can follow the initializer list here: there's no `new` to guard, and a failed assert stops everything anyway.
- `assert` isn't a function but a **macro**, a text replacement (lesson 5): before compiling, the preprocessor (lesson 13) rewrites each `assert(…)` into the check, or into nothing if the name `NDEBUG` ("no debugging") is defined.

> ⚠️ **Never check input with `assert`.** Release builds, the versions shipped to users, usually define `NDEBUG`, and then every `assert` vanishes, condition and all. Put `#define NDEBUG` above `#include <cassert>`, and `Ticket b {7};` goes through without a word: `7 zones: 625 cents`. So `assert` is for bugs that testing should catch; input needs a check that is always there. And never do real work inside one: `assert(card.tap(325));` only pays for the ride while asserts are on.

## `std::expected`: a value or a reason

Lesson 15's `std::optional` can say "no value", but not why. **`std::expected<T, E>`** (C++23, in `<expected>`, much newer than the book) holds either a value of type `T` or an error of type `E`:

```cpp
#include <expected>
#include <iostream>
#include <string>

constexpr int max_paid {2000};    // cents: the machine takes at most $20

std::expected<int, std::string> change_due(int price, int paid) {
    if (paid < price) {
        return std::unexpected{"not enough money"};
    }
    if (paid > max_paid) {
        return std::unexpected{"this machine takes at most $20"};
    }
    return paid - price;
}

void pay(int price, int paid) {
    auto change = change_due(price, paid);
    if (change) {
        std::cout << "change: " << *change << " cents\n";
    } else {
        std::cout << "error: " << change.error() << '\n';
    }
}

int main() {
    pay(325, 500);     // change: 175 cents
    pay(325, 200);     // error: not enough money
    pay(325, 5000);    // error: this machine takes at most $20
}
```

- The return type names both sides: the change is an `int` (cents), the reason a `std::string`.
- `return paid - price;` returns a value as usual. To return an error, wrap it in **`std::unexpected{…}`**, so it can never be mistaken for a value.
- `if (change)` is true when it holds a value, and then `*change` is that value; otherwise `change.error()` is the reason. For an object inside, `->` reaches its members (lesson 10): the exercise uses `card->balance()`.
- The rest works as on `std::optional` (lesson 15). `*change` and `change->` don't check: on an error they're undefined behaviour (here, a junk number and no warning), and so is `change.error()` on a value. `.value_or(0)` gives a default; `.value()` on an error stops with `bad_expected_access was thrown in -fno-exceptions mode`. Test with `if` first.
- `E` can be almost any type: an `enum class` (lesson 12) of possible errors, or a struct carrying details, like the home-made exception classes the book mentions (p. 29).

Compared with lesson 11's `bool`, the caller learns *why*. Compared with an exception, the error is in the return type, where every caller sees it, and the caller decides what's next: ask again, give up, print a message.

## Exercise: Opening a fare card

A machine opens fare cards. Riders type the starting amount in cents, so it's data from outside; a `Fare_card` with a negative balance would be a bug. The class is lesson 11's solution.

A constructor has no return type (lesson 11), so it can't hand back an error. Instead a plain function, `open_card`, checks the amount and only builds a card when it's good.

1. In the constructor, `assert` its precondition: `amount` is not negative.
2. Finish `open_card(int amount)`. A negative amount returns the error `"negative amount"`, one above 50000 cents returns `"over the $500 limit"`, and anything else reaches the `return Fare_card{amount};` that's already there. (A `Fare_card` converts into an expected holding it.)
3. In `main`, print `card opened: <balance> cents` if `card` holds a card, or `refused: <reason>` if it doesn't (use `card->balance()` and `card.error()`).

**Check** types these four amounts:

```stdin
1000 -250 60000 0
```

```expected
card opened: 1000 cents
refused: negative amount
refused: over the $500 limit
card opened: 0 cents
```

The starter runs but prints nothing. Do step 1 first and tap **Check**: the assert fires on −250, because `open_card` hands bad data straight to the constructor. That's a bug, caught. Step 2 fixes it.

```cpp starter
#include <cassert>
#include <expected>
#include <iostream>
#include <string>

class Fare_card {
public:
    Fare_card(int amount) : cents{amount}, ride_count{0} {
        // TODO 1: assert the precondition: amount is not negative
    }

    bool tap(int fare) {
        if (fare > cents) {
            return false;            // declined: nothing changes
        }
        cents -= fare;
        ++ride_count;
        return true;
    }

    int balance() { return cents; }
    int rides() { return ride_count; }

private:
    int cents;         // money left on the card; never negative
    int ride_count;    // rides paid for so far
};

std::expected<Fare_card, std::string> open_card(int amount) {
    // TODO 2: a negative amount: return the error "negative amount"
    //         above 50000 cents: return the error "over the $500 limit"
    return Fare_card{amount};
}

int main() {
    for (int i = 0; i < 4; ++i) {
        int amount {0};
        std::cin >> amount;
        auto card = open_card(amount);
        // TODO 3: print "card opened: <balance> cents" (card->balance())
        //         or "refused: <reason>" (card.error())
    }
}
```

```cpp solution
#include <cassert>
#include <expected>
#include <iostream>
#include <string>

class Fare_card {
public:
    Fare_card(int amount) : cents{amount}, ride_count{0} {
        assert(amount >= 0);
    }

    bool tap(int fare) {
        if (fare > cents) {
            return false;            // declined: nothing changes
        }
        cents -= fare;
        ++ride_count;
        return true;
    }

    int balance() { return cents; }
    int rides() { return ride_count; }

private:
    int cents;         // money left on the card; never negative
    int ride_count;    // rides paid for so far
};

constexpr int max_amount {50000};    // cents: $500

std::expected<Fare_card, std::string> open_card(int amount) {
    if (amount < 0) {
        return std::unexpected{"negative amount"};
    }
    if (amount > max_amount) {
        return std::unexpected{"over the $500 limit"};
    }
    return Fare_card{amount};
}

int main() {
    for (int i = 0; i < 4; ++i) {
        int amount {0};
        std::cin >> amount;
        auto card = open_card(amount);
        if (card) {
            std::cout << "card opened: " << card->balance() << " cents\n";
        } else {
            std::cout << "refused: " << card.error() << '\n';
        }
    }
}
```

Once it passes, add `Fare_card bad {-5};` as the first line of `main` and tap **▶ Run**. It stops before reading any input: `Assertion failed: amount >= 0 …`, then 💥 Program aborted. No input can do that any more: only a bug in the code can. Take the line out again.

Section 3.4.3, at the bottom of p. 30, moves the checking earlier still: to compile time, before the program ever runs.
