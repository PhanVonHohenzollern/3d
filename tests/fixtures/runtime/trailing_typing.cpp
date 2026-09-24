// A trailing statement that is still being typed is not executed.
double a = 1;
makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(a, 0, 0), 1, 1, 3);
double b = a * 2;
makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(b, 0,
