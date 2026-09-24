// Recursion and the 64-level call depth limit.
double depth = 0;

void recurse(int n)
{
    depth = n;
    makeSimpleTube(FdPoint3d(n, 0, 0), FdPoint3d(n, 1, 0), 1, 1, 3);
    recurse(n + 1);
}

void countdown(int n, double &acc)
{
    acc = acc + n;
    if (n > 0) countdown(n - 1, acc);
}

void run()
{
    double acc = 0;
    countdown(4, acc);
    recurse(0);
    double after = acc;
}
