// User functions: helpers, value/reference parameters, defaults, overloads.
//@line 999
//@eval g_total
double g_total = 0;
FdPoint3d g_origin(0, 0, 0);

void addBox(FdPoint3d p, FdVector3d n, double w)
{
    makeSimpleTube(p, p + n * w, w, w / 2, cpx);
}

void helper()
{
    double local = 3;
    makeSimpleTube(g_origin, g_origin + vz * local, 1, 1, 3);
}

void scale(double &value, double factor)
{
    value = value * factor;
}

void scaleConst(const double &value, double factor)
{
    value = value * factor;
}

void setPoint(FdPoint3d &out, double x)
{
    out = FdPoint3d(x, x * 2, x * 3);
}

void fill(double arr[3], double v)
{
    arr[0] = v;
    arr[2] = v * 2;
}

void fillRef(double (&arr)[3], double v)
{
    arr[1] = v;
}

void withDefault(double a, double b = 10, FdVector3d dir = vy)
{
    makeSimpleTube(FdPoint3d(a, 0, 0), FdPoint3d(a, 0, 0) + dir * b, 1, 1, 3);
}

void over(double a)
{
    g_total = g_total + a;
}

void over(double a, double b)
{
    g_total = g_total + a * b;
}

void nested(double x)
{
    helper();
    addBox(FdPoint3d(x, 0, 0), vx, x);
    return;
    addBox(FdPoint3d(-1, 0, 0), vx, 1);
}

void counter(int &n)
{
    n++;
    n += 10;
}

void main()
{
    helper();
    addBox(g_origin, vx, 5);
    double v = 2;
    scale(v, 4);
    scaleConst(v, 4);
    scale(3, 4);
    FdPoint3d target;
    setPoint(target, 1.5);
    double values[3] = {1, 2, 3};
    fill(values, 9);
    fillRef(values, 7);
    withDefault(1);
    withDefault(2, 3);
    withDefault(3, 4, vz);
    over(2);
    over(2, 3);
    over(1, 2, 3);
    nested(4);
    int c = 0;
    counter(c);
    counter(values[1]);
    double arr2[2] = {5, 6};
    scale(arr2[1], 2);
    scale(unknownThing, 2);
    addBox(g_origin, vx);
    helper(1);
    double result = g_total;
}
