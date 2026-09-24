// get_fln_size / get_fln_thick / get_fln_diam / get_ldist / get_ext_diam.
//@param DN100:get_fln_size=120
//@param DN100:get_fln_thick=8
//@param :get_ldist=35.5
//@param P1:get_ext_diam=abc
//@line 999
//@line 9
double size = 10;
double thick = 1;
int diam = 2;
double ldist = 0;
double ext = 5;
double arr[2];
get_fln_size("DN100", size);
get_fln_thick("DN100", thick);
get_fln_diam("DN100", diam);
get_ldist(3, ldist);
get_ext_diam("P1", ext);
get_fln_size("DN100", arr[1]);
get_fln_size("DN100");
get_fln_size("DN100", size, 3);
get_fln_size("DN100", missingDest);
get_fln_size(1 / 0, size);
get_fln_size("DN100", size);
makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(size, thick, diam), ldist, ext, 3);
