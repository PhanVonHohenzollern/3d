// User functions are statements; calls inside expressions are unsupported.
//@line 999
double twice(double a)
{
    return a * 2;
}
void run()
{
    double x = twice(3);
    double y = 1 + twice(2);
    twice(4);
    if (twice(1)) x = 1;
    makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(twice(1), 0, 0), 1, 1, 3);
}
