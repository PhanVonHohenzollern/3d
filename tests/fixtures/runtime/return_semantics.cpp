// 'return' ends the current function; its value is not evaluated.
//@line 999
//@line 26
double g = 0;
void early(double a)
{
    makeSimpleTube(FdPoint3d(a, 0, 0), FdPoint3d(a, 1, 0), 1, 1, 3);
    if (a > 1) return;
    makeSimpleTube(FdPoint3d(a, 2, 0), FdPoint3d(a, 3, 0), 1, 1, 3);
}
double value(double a)
{
    return unknownThing / 0;
}
void loops()
{
    for (int i = 0; i < 5; i++) {
        for (int j = 0; j < 5; j++) {
            if (i * j == 2) return;
            makeSimpleTube(FdPoint3d(i, j, 0), FdPoint3d(i, j, 1), 1, 1, 3);
        }
    }
    makeSimpleTube(FdPoint3d(9, 9, 9), FdPoint3d(9, 9, 10), 1, 1, 3);
}
void entry()
{
    early(1);
    early(2);
    double v = value(3);
    value(3);
    loops();
    return 5;
    early(10);
}
