// Cursor position selects the executed function; globals run first.
//@line 3
//@line 10
//@line 13
//@line 20
//@line 23
//@line 999
double g = 1;
FdVector3d gv = vx * g;

void first(double a, FdPoint3d p, int n = 4)
{
    double x = a + n;
    makeSimpleTube(p, p + gv * x, 1, 1, 3);
    g = g + 1;
}

double between = g * 2;

void second(MyType *obj, double w[2], const FdVector3d &dir)
{
    double y = w[0] + between;
    makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(y, 0, 0) + dir, 1, 1, 3);
}

double afterAll = between + g;
