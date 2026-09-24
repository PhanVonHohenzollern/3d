// Reference parameters are written back to the caller's l-value.
//@line 999
//@line 30
void setAll(FdPoint3d &p, FdVector3d &v, double &d, int &i, bool &b, double arr[2], double (&ra)[2])
{
    p = FdPoint3d(1, 2, 3);
    v = vz * 2;
    d = 2.5;
    i = 7.9;
    b = 1;
    arr[0] = 5;
    ra[1] = 6;
}
void redeclareRef(double &out)
{
    double out = 11;
}
void untouched(double &same)
{
    same = same;
}
void typeChange(double &d)
{
    d = FdPoint3d(1, 1, 1);
}
void memberRef(double &m)
{
    m = 4;
}
void run()
{
    FdPoint3d p;
    FdVector3d v;
    double d = 0;
    int i = 0;
    bool b = false;
    double arr[2] = {0, 0};
    double ra[2] = {0, 0};
    setAll(p, v, d, i, b, arr, ra);
    redeclareRef(d);
    untouched(d);
    typeChange(d);
    memberRef(p.y);
    FdPoint3d pts[2];
    int k = 1;
    memberRef(pts[k].x);
    memberRef(arr[k + 5]);
    memberRef(d + 1);
    setAll(pts[0], v, arr[0], i, b, ra, arr);
}
