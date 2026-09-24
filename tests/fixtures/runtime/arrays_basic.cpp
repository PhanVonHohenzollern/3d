// Arrays: extents, inferred extents, initializers, element access.
//@line 999
//@line 12
//@eval a3[1] + m2[1][0]
//@eval pts[1].x
//@eval ap[2]
double a3[3];
int i3[3] = {1, 2, 3};
double partial[4] = {1.5, 2.5};
int inferred[] = {4, 5, 6, 7};
double trailing[] = {1, 2, };
int holes[4] = {1, , 3};
int emptyInit[] = {};
int m2[2][3] = {{1, 2, 3}, {4, 5, 6}};
int mInfer[][2] = {{1, 2}, {3, 4}, {5, 6}};
int mRagged[2][] = {{1}, {2, 3, 4}};
int flat[2][2] = {1, 2, 3, 4};
int scalarInit[3] = 9;
int tooMany[2] = {1, 2, 3};
FdPoint3d pts[3] = {FdPoint3d(0, 0, 0), FdPoint3d(1, 0, 0) + vy};
FdVector3d vecs[] = {vx, vy, vz, vx + vy};
ads_point ap = {1, 2, 3};
ads_point apa[2] = {{1, 2, 3}, {4, 5, 6}};
ads_real ar[2] = {1, 2};
char *names[2] = {"one", "two"};
bool flags[3] = {1, 0, 2.5};
const int N = 4;
double sized[N + 1];
double sizedNeg[-3];
double sizedExpr[N / 2];
a3[0] = 1;
a3[1] = a3[0] + 1;
a3[2] += 5;
m2[1][2] = 60;
pts[2] = pts[1] + vz;
pts[0].x = 9;
vecs[3] = vecs[3] * 2;
double e1 = i3[1] * 2;
double e2 = m2[1][0];
double e3 = pts[1].y + pts[1][1];
double outOfRange = i3[3];
a3[5] = 1;
a3[-1] = 1;
double idxExpr = i3[N - 2];
double wrongIndex = i3[1.9];
int directArr[2](1, 2);
double pointIndex = p0[0];
m2[0] = i3;
