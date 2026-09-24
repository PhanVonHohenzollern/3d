// Function bodies see globals; scalar writes are rolled back, shared array
// element writes persist; locals and ids are restored after the call.
//@eval gScalar
//@eval gArr[0]
double gScalar = 1;
double gArr[2] = {1, 2};
FdPoint3d gPt(1, 1, 1);

void mutate(double shadow)
{
    gScalar = 50;
    gArr[0] = 99;
    gPt.x = 7;
    double gArr2 = 3;
    double shadow2 = shadow + gScalar;
    makeSimpleTube(gPt, gPt + vx * shadow2, gArr[0], gArr[1], 3);
}

void redeclare()
{
    double gArr[2] = {-1, -2};
    gArr[1] = -3;
    int gScalar = 4;
}

void entry()
{
    double shadow = 5;
    mutate(shadow);
    double s1 = gScalar;
    double a0 = gArr[0];
    double px = gPt.x;
    redeclare();
    double a1 = gArr[1];
    double s2 = gScalar;
    mutate(gArr[1]);
}
