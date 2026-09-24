// Unnamed, qualified and defaulted parameters; failing defaults.
//@line 999
//@line 12
double g = 1;
void unnamed(double, FLM3Geo::primitiveMode, unsigned, const double)
{
    g = 2;
}
void qualified(FLM3Geo::primitiveMode mode, const FdVector3d &dir = FdVector3d::kZAxis, int n = cpx * 2)
{
    makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(0, 0, 0) + dir * n, mode, n, 3);
}
void badDefault(double a, double b = unknownVar, double c = 1 / 0)
{
    makeSimpleTube(FdPoint3d(a, 0, 0), FdPoint3d(a, 1, 0), 1, 1, 3);
}
void unnamedRef(double &, int &count)
{
    count = 5;
}
void qualifierOnlyRef(unsigned &, int &n)
{
    n = 9;
}
void voidParams(void)
{
    makeSimpleTube(FdPoint3d(9, 0, 0), FdPoint3d(9, 1, 0), 1, 1, 3);
}
void intersectInside(FdPoint3d &out)
{
    lineToLineInt(FdPoint3d(0, 0, 0), FdPoint3d(1, 0, 0), FdPoint3d(0.5, -1, 0), FdPoint3d(0.5, 1, 0), out);
}
void same(int a) { g = a; }
void same(double b) { g = -b; }
void run()
{
    double d = 0;
    int c = 0;
    unnamed(1, 2, 3, 4);
    qualified(FLM3Geo::pmExtInsulation);
    qualified(1, vx);
    badDefault(3);
    unnamedRef(d, c);
    voidParams();
    qualifierOnlyRef(d, c);
    voidParams(1);
    FdPoint3d hit;
    intersectInside(hit);
    same(4);
}
