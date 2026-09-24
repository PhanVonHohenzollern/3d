// Copies of points, vectors and arrays are independent values.
//@line 999
double a[2] = {1, 2};
double b[2];
b = a;
b[0] = 50;
double m[2][2] = {{1, 2}, {3, 4}};
double row[2] = {7, 8};
m[0] = row;
row[0] = -1;
double row2[2] = m[1];
FdPoint3d p(1, 1, 1);
FdPoint3d q = p;
q.x = 5;
FdPoint3d pa[2] = {p, q};
pa[0].y = 9;
FdVector3d v = vx;
FdVector3d w = v;
w.normalize();
w.set(0, 3, 4);
v = w;
w.normalize();
double arr3[3] = {1, 2, 3};
double copyArr[3] = arr3;
double viaCall = 0;
void change(double arr[3], double &out)
{
    arr[0] = 100;
    out = arr[0] + arr[1];
}
void entry()
{
    double local[3] = {1, 2, 3};
    change(local, viaCall);
    change(arr3, arr3[2]);
    makeBox(2, local, vx, arr3[0], arr3[2], false);
}
