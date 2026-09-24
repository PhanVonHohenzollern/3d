// if / else chains, nested branches and cursor positions inside branches.
//@line 999
//@line 9
//@line 12
//@line 20
//@line 27
double a = 5;
double r = 0;
if (a > 3)
{
    r = 1;
    double inside = a * 2;
    r = inside + 1;
}
else
{
    r = -1;
}
if (a < 3) r = 10; else r = r + 20;
if (a == 5)
    if (r > 100) r = 0;
    else r = r * 2;
if (a > 100) {
    r = 1000;
} else if (a > 4) {
    r = r + 0.5;
    if (r > 10) {
        double deep = r;
        deep += 1;
    }
} else {
    r = -5;
}
if (unknownCond) r = 99;
if (1 / 0) r = 98;
if (vx) r = r + 1;
if ("") r = 97;
if (NULL) r = 96;
if (a) {} else {}
if (a > 1);
makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(r, 0, 0), 1, 1, 3);
