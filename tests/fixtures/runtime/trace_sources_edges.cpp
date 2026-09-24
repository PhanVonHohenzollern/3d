// Value-source capture edge cases in API argument traces.
//@param getIntInsSize=5 arr[1 + idx[0]] w[1
//@line 999
#define DUP(a, a) (a)
double w = 2;
double arr[3] = {1, 2, 3};
int idx[2] = {1, 0};
FdPoint3d pts[2] = {FdPoint3d(1, 2, 3), FdPoint3d(4, 5, 6)};
bool flag = false;
double dup = DUP(1, 2);
foo(pts[idx[0]], arr[idx[1] + 1], arr[5], w[0], w.x, arr[1].x, pts[1][2], pts[1][5]);
foo(a, dup, arr[-1], arr[w], arr["s"], pts[0].y, FLM3Geo::pmNormal, vx.normal().x);
foo(arr[1 / 0], arr[unknown], arr[(1)], arr);
if (getIntInsSize(flag)) w = 3;
foo(flag, w);
a = 7;
foo(a);
