// PnGeometry.h 2-D helpers take ads_point corners and draw flat strokes and
// fills in the XY plane (planar adapter): lines, a dashed line, circles, an
// arc in AutoCAD radians and a closed polygon.
ads_point a = {0, 0, 0};
ads_point b = {100, 0, 0};
ads_point c = {100, 60, 0};
ads_point d = {0, 60, 0};
make_line(a, b);
make_thin_line(b, c);
make_dashed_line(a, c);
make_circle(c, 25);
make_filled_circle(a, 10);
make_arc(b, 30, 0, 1.5);
make_polygon(a, b, c, d);
