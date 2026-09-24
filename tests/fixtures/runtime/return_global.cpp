// A global 'return' stops the selected function as well.
double a = 1;
return;
double b = 2;
void f()
{
    double c = a + b;
    makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(c, 0, 0), 1, 1, 3);
}
