# Curriculum roadmap

If there's a textbook in `textbook/`, lessons follow the book instead, and this
roadmap is only used once the book is finished (or when there's no book).

The lesson generator picks the first topic below that isn't covered yet by an
existing lesson. Edit freely: reorder, add topics you care about, or mark a
line with `(skip)`. Lessons are generated in order, so this is how you steer
what you learn next.

## Foundations (lessons 1–8, written)
- Hello world, compiling, std::cout
- Variables, types, auto, const
- if/else, loops, range-for
- Functions, pass by value/reference, const&
- std::vector and <algorithm>, lambdas
- Reading input with std::cin and std::getline
- Structs, classes, constructors/destructors, RAII
- Pointers and std::unique_ptr

## Next up
- std::string in depth: find, substr, string_view, building strings
- Formatted output with std::format and std::print (C++23)
- Enums: enum class and switch
- std::array and fixed-size data; C arrays and why to avoid them
- std::map and std::unordered_map: counting words
- std::set and uniqueness
- std::pair, std::tuple and structured bindings
- std::optional for "maybe a value"
- Error handling without exceptions: std::expected (C++23)
- Operator overloading: making a Vec2 type
- Copy vs move semantics; the rule of zero
- const correctness in classes
- Function templates
- Class templates: writing a tiny Stack<T>
- Concepts: constraining templates (C++20)
- Iterators and how range-for works
- Ranges and views: filter, transform, take (C++20)
- Recursion: factorial, Fibonacci, and memoisation
- Inheritance and virtual functions
- Polymorphism without inheritance: std::variant and std::visit
- std::shared_ptr, weak_ptr and ownership graphs
- Lambdas in depth: captures by value/reference, mutable, generic lambdas
- constexpr and compile-time computation
- Undefined behaviour: what it is and how to spot it
- Bit manipulation: flags, masks and std::bitset
- Big-O by experiment: timing vector vs list with <chrono>
- Mini project: a subway route planner with BFS
- Mini project: a text adventure state machine
- Mini project: a tiny tokenizer and calculator
