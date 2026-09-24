// Cursor positions inside and around functions with loops.
//@line 1
//@line 6
//@line 8
//@line 9
//@line 10
//@line 12
//@line 14
//@line 16
//@line 18
//@line 20
//@line 21
//@line 24
//@line 999
double g = 5;
void draw(double size)
{
    FdPoint3d c(0, 0, 0);
    for (int i = 0; i < 3; i++)
    {
        c = c + vx * size;
        makeSimpleTube(c, c + vz * size, size, size, 3);
    }
    double tail = size * 2;
}
double between = g + 1;
void entry(double scale = 2)
{
    double s = scale * between;
    draw(s);
    if (s > 5)
    {
        draw(1);
    }
    double end = s;
}
double trailing = 1;
